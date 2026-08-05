import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { LinkCodeStore } from '../domain-services/link-code.store';
import { LinkWaitStore } from '../domain-services/link-wait.store';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { Env } from '../../../system/config/env.schema';
import type { TelegramLinkStatus } from '../interfaces/telegram-link-status.interface';
import type { TelegramLinkCodeView } from '../interfaces/telegram-link-code-view.interface';

/**
 * Управление привязкой Telegram из личного кабинета (2.9.1·14).
 *
 * Привязка нужна для заявок на дополнительные приглашения: начислять квоту по словам человека
 * нельзя, аккаунт должен быть подтверждён ([ADR-0064 §12](../../../../docs/decisions/0064-telegram-release-channel.md)).
 * **Сама по себе она не включает уведомления** — это отдельное согласие, его бот спрашивает
 * явно (·15).
 */
@Injectable()
export class ManageTelegramLinkUseCase {
  private readonly _botUsername: string;
  private readonly _settingsUrl: string;

  /**
   * @param _repository Порт репозитория привязок.
   * @param _api Исходящий порт Bot API (ответы на команды `/link` и `/unlink`).
   * @param _codes Одноразовые коды привязки (в памяти процесса).
   * @param _waiting Ожидание кода после голой команды `/link`.
   * @param configService Конфиг (имя бота для ссылки на экране).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _codes: LinkCodeStore,
    private readonly _waiting: LinkWaitStore,
    configService: ConfigService<Env, true>,
  ) {
    this._botUsername = configService.get('TELEGRAM_BOT_USERNAME', { infer: true }).replace(/^@/, '');
    this._settingsUrl = `${configService.get('PUBLIC_BASE_URL', { infer: true }).replace(/\/+$/, '')}/app/settings`;
  }

  /**
   * Показывает состояние привязки аккаунта.
   * @param accountId Аккаунт.
   * @returns Статус для экрана настроек.
   */
  public async getStatus(accountId: string): Promise<TelegramLinkStatus> {
    const link = await this._repository.findLinkByAccount(accountId);
    const botUsername = this._botUsername;
    if (link === null) {
      return { linked: false, linkedAt: null, notificationsAllowed: false, botUsername };
    }
    // `chat_id` наружу не отдаём: экрану он не нужен, а это идентификатор человека в чужом
    // сервисе — чем меньше мест, где он появляется, тем лучше (ADR-0064 §10).
    return {
      linked: true,
      linkedAt: link.createdAt.toISOString(),
      notificationsAllowed: link.notificationsAllowed,
      botUsername,
    };
  }

  /**
   * Выдаёт одноразовый код для привязки.
   * @param accountId Аккаунт.
   * @returns Код и срок его жизни.
   */
  public issueCode(accountId: string): TelegramLinkCodeView {
    return { code: this._codes.issue(accountId), expiresInSeconds: this._codes.ttlSeconds };
  }

  /**
   * Отвязывает чат от аккаунта.
   *
   * Молча проходит и когда привязки нет: человек нажал «отвязать» — он хочет результат, а не
   * сообщение об ошибке про состояние, которое его и так устраивает.
   * @param accountId Аккаунт.
   * @returns Промис завершения.
   */
  public async unlink(accountId: string): Promise<void> {
    const link = await this._repository.findLinkByAccount(accountId);
    if (link === null) {
      return;
    }
    await this._repository.deleteLinkByChat(link.chatId);
  }

  /**
   * Привязывает чат по коду из личного кабинета (команда `/link КОД` у бота).
   *
   * **Код — единственное доказательство, что чат принадлежит владельцу аккаунта.** По логину
   * привязываться нельзя: логины публичны, и тогда любой чат прицепился бы к чужой квоте.
   * @param chatId Чат.
   * @param codeRaw Что человек написал после команды (пусто — попросим код следующим сообщением).
   * @returns Промис завершения.
   */
  public async linkByCode(chatId: string, codeRaw: string): Promise<void> {
    if (codeRaw === '') {
      // Просим код и ждём его следующим сообщением: заставлять человека набирать команду с
      // аргументом — лишний шаг там, где он и так уже сказал, чего хочет.
      this._waiting.start(chatId);
      await this._api.sendMessage(
        chatId,
        [
          'Пришли <b>код привязки</b> одним сообщением.',
          '',
          `Взять его — в личном кабинете: <a href="${this._settingsUrl}">Настройки → Telegram</a>.`,
          '',
          'Передумал — /cancel.',
        ].join('\n'),
      );
      return;
    }
    const accountId = this._codes.consume(codeRaw);
    if (accountId === null) {
      await this._api.sendMessage(
        chatId,
        'Код не подошёл — он одноразовый и живёт 10 минут. Возьми новый в «Настройки → Telegram».',
      );
      return;
    }

    // Обе стороны уникальны в БД, поэтому старые привязки снимаем сами: иначе вставка упадёт,
    // а человек увидит ошибку там, где хотел просто перепривязать чат.
    const previousOfAccount = await this._repository.findLinkByAccount(accountId);
    if (previousOfAccount !== null) {
      await this._repository.deleteLinkByChat(previousOfAccount.chatId);
    }
    const previousOfChat = await this._repository.findLinkByChat(chatId);
    if (previousOfChat !== null) {
      await this._repository.deleteLinkByChat(chatId);
    }

    await this._repository.createLink(generateId(), accountId, chatId);
    await this._api.sendMessage(
      chatId,
      [
        '✅ <b>Чат привязан к аккаунту.</b>',
        '',
        'Теперь можно просить дополнительные приглашения — я буду знать, кому их начислять.',
        '',
        'Писать тебе сам я при этом не начну: это отдельное согласие, и я спрошу о нём отдельно.',
      ].join('\n'),
    );
  }

  /**
   * Отвязывает чат по команде `/unlink` у бота.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async unlinkByChat(chatId: string): Promise<void> {
    const link = await this._repository.findLinkByChat(chatId);
    if (link === null) {
      await this._api.sendMessage(chatId, 'Этот чат ни к какому аккаунту не привязан.');
      return;
    }
    await this._repository.deleteLinkByChat(chatId);
    await this._api.sendMessage(
      chatId,
      'Отвязал. Просить приглашения отсюда больше нельзя — привязать заново можно в «Настройки → Telegram».',
    );
  }
}
