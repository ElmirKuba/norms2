import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { TelegramUpdate } from '../interfaces/telegram-update.interface';
import type { Env } from '../../../system/config/env.schema';

/** Ответы бота, которые не зависят от шага диалога. */
const REPLY = {
  greetingGuest: [
    'Привет! Это бот «Нормисов» — площадки по приглашениям.',
    '',
    'Нет приглашения? Оставь заявку: /join',
    'Уже есть аккаунт, но кончились приглашения? /invites',
    'Что умеет бот: /help',
  ].join('\n'),
  greetingOwner: [
    'Привет, владелец. Отсюда разбираются заявки.',
    '',
    '📋 Очередь заявок: /queue',
    'Справка: /help',
  ].join('\n'),
  helpGuest: [
    '<b>Что умеет этот бот</b>',
    '',
    '/join — заявка на вступление, если приглашения нет',
    '/invites — попросить ещё приглашений (нужен аккаунт)',
    '/cancel — прервать заполнение заявки',
    '',
    'Личные данные писать не нужно — мы их не храним.',
  ].join('\n'),
  unknown: 'Не понял команду. Что я умею — /help',
} as const;

/**
 * Domain-service Telegram-области: маршрутизация апдейтов (2.9.1·9).
 *
 * **Порядок проверок здесь — часть безопасности, а не стиль.**
 * 1. Повтор апдейта отсекается до любых действий: Telegram повторяет доставку, и без этого
 *    заявка создалась бы дважды, а код выдался бы дважды.
 * 2. **Владелец определяется ДО разбора команды** (`TELEGRAM_OWNER_CHAT_ID`). Это главная
 *    граница фичи: бот умеет выдавать приглашения, и если сверять автора после разбора, то
 *    любой, кто дотянется до вебхука, выдаст их себе
 *    ([ADR-0064 §2a](../../../../docs/decisions/0064-telegram-release-channel.md)).
 *
 * ⚠️ **Тело апдейта не логируется никогда** — там имя, возраст и «зачем».
 */
@Injectable()
export class TelegramDomainService {
  private readonly _logger = new Logger('Telegram');
  private readonly _ownerChatId: string;

  /**
   * @param _repository Порт репозитория заявок.
   * @param _api Исходящий порт Bot API.
   * @param configService Конфиг (чат владельца).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    configService: ConfigService<Env, true>,
  ) {
    this._ownerChatId = configService.get('TELEGRAM_OWNER_CHAT_ID', { infer: true });
  }

  /**
   * Обрабатывает апдейт целиком.
   * @param update Апдейт из Bot API.
   * @returns Промис завершения.
   */
  public async handleUpdate(update: TelegramUpdate): Promise<void> {
    const isFirstTime = await this._repository.markUpdateProcessed(update.update_id);
    if (!isFirstTime) {
      this._logger.log(`Апдейт ${update.update_id} уже обработан — повтор пропущен.`);
      return;
    }

    if (update.callback_query !== undefined) {
      await this._handleCallback(update.callback_query.id, update.callback_query.data);
      return;
    }

    const message = update.message;
    if (message === undefined) {
      return;
    }
    const chatId = String(message.chat.id);
    // Владелец определяется здесь — до того, как мы посмотрели, что за команда пришла.
    const isOwner = this._ownerChatId !== '' && chatId === this._ownerChatId;
    await this._handleMessage(chatId, isOwner, message.text);
  }

  /**
   * Разбирает текстовое сообщение.
   * @param chatId Чат.
   * @param isOwner Владелец ли пишет.
   * @param text Текст (может отсутствовать — стикер, фото).
   * @returns Промис завершения.
   */
  private async _handleMessage(
    chatId: string,
    isOwner: boolean,
    text: string | undefined,
  ): Promise<void> {
    if (text === undefined) {
      await this._api.sendMessage(chatId, 'Мне нужен текст — картинки и стикеры я не понимаю.');
      return;
    }
    const command = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';

    if (command === '/start') {
      await this._api.sendMessage(chatId, isOwner ? REPLY.greetingOwner : REPLY.greetingGuest);
      return;
    }
    if (command === '/help') {
      await this._api.sendMessage(chatId, isOwner ? REPLY.greetingOwner : REPLY.helpGuest);
      return;
    }
    // Команды владельца исполняются ТОЛЬКО из его чата. Для всех остальных их как бы нет —
    // отвечаем обычным «не понял», не подсказывая, что такая команда существует.
    if (command === '/queue') {
      await this._api.sendMessage(
        chatId,
        isOwner ? 'Очередь заявок появится в следующем шаге (·12).' : REPLY.unknown,
      );
      return;
    }
    // TODO: Claude Code: 2026-08-05: /join и /invites — пошаговый диалог заявителя (шаг ·10).
    if (command === '/join' || command === '/invites') {
      await this._api.sendMessage(chatId, 'Приёмная заявок ещё настраивается — загляни позже.');
      return;
    }
    await this._api.sendMessage(chatId, REPLY.unknown);
  }

  /**
   * Разбирает нажатие инлайн-кнопки.
   * @param callbackQueryId Идентификатор нажатия.
   * @param data Данные кнопки.
   * @returns Промис завершения.
   */
  private async _handleCallback(callbackQueryId: string, data: string | undefined): Promise<void> {
    // TODO: Claude Code: 2026-08-05: разбор действий владельца по кнопкам (шаг ·11).
    // Гасим «часики» в любом случае: без ответа Telegram крутит их 30 секунд.
    await this._api.answerCallback(callbackQueryId, data === undefined ? undefined : 'Пока не умею');
  }
}
