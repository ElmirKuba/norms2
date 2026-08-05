import { Inject, Injectable } from '@nestjs/common';
import { TelegramDomainService } from '../domain-services/telegram.domain-service';
import { OwnerActionsUseCase } from './owner-actions.use-case';
import { RequestInvitesUseCase } from './request-invites.use-case';
import { ManageTelegramLinkUseCase } from './manage-telegram-link.use-case';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { GuestOutcome } from '../domain-services/telegram.domain-service';
import type { TelegramUpdate } from '../interfaces/telegram-update.interface';

/** Префиксы кнопок начисления: номинал прямо в префиксе (`g3` = «+3»). */
const GRANT_PREFIXES = new Set(['g1', 'g3', 'g5']);

/**
 * Маршрутизатор апдейтов (2.9.1·9, расширен в ·11–·12).
 *
 * **Порядок проверок — часть безопасности, а не стиль:**
 * 1. повтор апдейта отсекается **до любых действий** — Telegram повторяет доставку, и без этого
 *    заявка создалась бы дважды, а код выдался бы дважды;
 * 2. **владелец определяется до разбора команды.** Бот умеет выдавать приглашения; сверяй мы
 *    автора после разбора — любой, кто дотянется до вебхука, выдал бы их себе
 *    ([ADR-0064 §2a](../../../../docs/decisions/0064-telegram-release-channel.md)).
 *
 * Кросс-домен живёт здесь: выдача приглашения ходит в `invites` и `account`, и по правилам
 * такие вызовы делает use-case, а не domain-service.
 */
@Injectable()
export class HandleTelegramUpdateUseCase {
  /**
   * @param _telegramDomainService Гостевая часть (меню, анкета).
   * @param _ownerActions Сценарий владельца (очередь, решения).
   * @param _requestInvites Просьба о дополнительных приглашениях (нужен аккаунт заявителя).
   * @param _manageLink Привязка чата к аккаунту (`/link КОД`, `/unlink`).
   * @param _api Исходящий порт Bot API (гашение «часиков» на кнопке).
   */
  public constructor(
    private readonly _telegramDomainService: TelegramDomainService,
    private readonly _ownerActions: OwnerActionsUseCase,
    private readonly _requestInvites: RequestInvitesUseCase,
    private readonly _manageLink: ManageTelegramLinkUseCase,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
  ) {}

  /**
   * Обрабатывает апдейт.
   * @param update Апдейт из Bot API.
   * @returns Промис завершения.
   */
  public async execute(update: TelegramUpdate): Promise<void> {
    if (!(await this._telegramDomainService.consumeUpdate(update.update_id))) {
      return;
    }

    const callback = update.callback_query;
    if (callback !== undefined) {
      const chatType = callback.message?.chat.type;
      if (chatType !== undefined && chatType !== 'private') {
        return;
      }
      const chatId = callback.message?.chat.id;
      // Гасим «часики» сразу: без ответа Telegram крутит их 30 секунд, и человек решает,
      // что бот завис. Делаем это ДО работы, которая может занять время.
      await this._api.answerCallback(callback.id);
      if (chatId !== undefined) {
        await this._routeCallback(String(chatId), callback.data);
      }
      return;
    }

    const message = update.message;
    if (message === undefined) {
      return;
    }
    // Отвечаем ТОЛЬКО в личке. В группе бот получает служебные апдейты — «сменили фото»,
    // «добавили участника», — у них нет текста, и диалоговая ветка отвечала на каждый
    // «мне нужен текст». Поймано 05.08.2026, когда бота добавили в общий чат проекта.
    if (message.chat.type !== undefined && message.chat.type !== 'private') {
      return;
    }
    await this._routeMessage(String(message.chat.id), message.text);
  }

  /**
   * Раскладывает сообщение по сценариям.
   * @param chatId Чат.
   * @param text Текст.
   * @returns Промис завершения.
   */
  private async _routeMessage(chatId: string, text: string | undefined): Promise<void> {
    // Привязка — команда для всех, включая владельца: аккаунт у него такой же, как у остальных,
    // и отдельный путь для него означал бы вторую реализацию той же вещи.
    if (text !== undefined) {
      const trimmed = text.trim();
      const command = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
      if (command === '/link') {
        await this._manageLink.linkByCode(chatId, trimmed.slice('/link'.length).trim());
        return;
      }
      if (command === '/unlink') {
        await this._manageLink.unlinkByChat(chatId);
        return;
      }
    }
    if (!this._telegramDomainService.isOwner(chatId)) {
      await this._finish(chatId, await this._telegramDomainService.handleGuestMessage(chatId, text));
      return;
    }
    if (text === undefined) {
      await this._ownerActions.sendMenu(chatId);
      return;
    }
    const trimmed = text.trim();
    const command = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';

    if (command === '/start' || command === '/menu') {
      await this._ownerActions.sendMenu(chatId);
      return;
    }
    // Владелец мог нажать кнопку решения и теперь пишет причину. Проверяем ПОСЛЕ команд:
    // иначе «/start», набранный вместо причины, стал бы подписью к приглашению.
    if (await this._ownerActions.applyReason(chatId, trimmed)) {
      return;
    }
    // Владелец — тоже человек: если он проходит анкету, отдаём гостевой сценарий.
    await this._finish(chatId, await this._telegramDomainService.handleGuestMessage(chatId, text));
  }

  /**
   * Доводит исход гостевого диалога, если для него нужен чужой домен.
   *
   * Domain-service не ходит в `account` сам (правила зависимостей), поэтому просьба о
   * приглашениях возвращается сюда — и дальше её ведёт use-case.
   * @param chatId Чат.
   * @param outcome Чем закончился разбор.
   * @returns Промис завершения.
   */
  private async _finish(chatId: string, outcome: GuestOutcome): Promise<void> {
    if (outcome.type === 'invitesRequested') {
      await this._requestInvites.start(chatId);
      return;
    }
    if (outcome.type === 'invitesReady') {
      await this._requestInvites.submit(chatId, outcome.purpose);
    }
  }

  /**
   * Раскладывает нажатие кнопки.
   * @param chatId Чат.
   * @param data Данные кнопки.
   * @returns Промис завершения.
   */
  private async _routeCallback(chatId: string, data: string | undefined): Promise<void> {
    if (data === undefined) {
      return;
    }
    const isOwner = this._telegramDomainService.isOwner(chatId);
    const separator = data.indexOf(':');
    const prefix = separator === -1 ? data : data.slice(0, separator);
    const payload = separator === -1 ? '' : data.slice(separator + 1);

    // Кнопки владельца исполняются только из его чата. Для чужих их как бы нет.
    if (isOwner && (prefix === 'q' || prefix === 'h')) {
      await this._ownerActions.showQueue(chatId, Number(payload) || 0, prefix === 'h');
      return;
    }
    if (isOwner && prefix === 'c') {
      await this._ownerActions.showCard(chatId, payload);
      return;
    }
    if (isOwner && prefix === 'menu') {
      await this._ownerActions.sendMenu(chatId);
      return;
    }
    if (isOwner && prefix === 'cancel') {
      await this._ownerActions.cancelPending(chatId);
      return;
    }
    if (isOwner && (prefix === 'ok' || prefix === 'no')) {
      await this._ownerActions.askReason(chatId, prefix === 'ok' ? 'approve' : 'reject', payload);
      return;
    }
    // Согласие на уведомления — кнопка не владельца, а любого человека (·15).
    if (prefix === 'nt') {
      await this._telegramDomainService.setNotificationsConsent(chatId, payload === '1');
      return;
    }
    // Номинал начисления зашит в сам префикс кнопки (`g1` / `g3` / `g5`): в `callback_data`
    // остаётся 12 символов сверх идентификатора заявки, отдельного поля туда не положить.
    if (isOwner && GRANT_PREFIXES.has(prefix)) {
      await this._ownerActions.askGrantReason(chatId, Number(prefix.slice(1)), payload);
      return;
    }
    await this._finish(chatId, await this._telegramDomainService.handleGuestCallback(chatId, data));
  }
}
