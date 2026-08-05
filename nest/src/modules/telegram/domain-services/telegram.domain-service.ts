import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { TelegramUpdate } from '../interfaces/telegram-update.interface';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { RequestDraftStore } from './request-draft.store';
import { PRIVACY_NOTICE, QUESTIONS, validateAnswer } from './request-dialog.util';
import type { Env } from '../../../system/config/env.schema';

/**
 * Экранирует текст под HTML-разметку Telegram.
 *
 * Обязательно именно здесь: в карточку владельцу подставляется то, что написал человек, а он
 * может прислать `<b>` или `&`. Без экранирования Telegram отклонит сообщение целиком —
 * и заявка просто не дойдёт.
 * @param text Ответ человека.
 * @returns Безопасный фрагмент.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
    private readonly _drafts: RequestDraftStore,
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
    if (command === '/cancel') {
      this._drafts.forget(chatId);
      await this._api.sendMessage(chatId, 'Заполнение прервано. Захочешь вернуться — /join');
      return;
    }
    if (command === '/join') {
      await this._startJoin(chatId);
      return;
    }
    // TODO: Claude Code: 2026-08-05: /invites — заявка на дополнительные приглашения (шаг ·13).
    if (command === '/invites') {
      await this._api.sendMessage(chatId, 'Заявки на приглашения ещё настраиваются — загляни позже.');
      return;
    }

    // Не команда: возможно, это ответ на вопрос анкеты. Проверяем ПОСЛЕ команд, чтобы «/cancel»
    // посреди диалога оставался командой, а не ответом на вопрос «зачем тебе Нормисы».
    const draft = this._drafts.get(chatId);
    if (draft !== null) {
      await this._continueDraft(chatId, text);
      return;
    }
    await this._api.sendMessage(chatId, REPLY.unknown);
  }

  /**
   * Начинает анкету, если у чата нет незакрытой заявки.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  private async _startJoin(chatId: string): Promise<void> {
    const pending = await this._repository.findPendingByChat(chatId);
    if (pending !== null) {
      await this._api.sendMessage(
        chatId,
        'У тебя уже есть заявка на рассмотрении. Я напишу, как только будет решение.',
      );
      return;
    }
    this._drafts.start(chatId);
    await this._api.sendMessage(chatId, PRIVACY_NOTICE);
    await this._api.sendMessage(chatId, QUESTIONS.name);
  }

  /**
   * Принимает ответ на текущий вопрос анкеты.
   * @param chatId Чат.
   * @param text Ответ.
   * @returns Промис завершения.
   */
  private async _continueDraft(chatId: string, text: string): Promise<void> {
    const draft = this._drafts.get(chatId);
    if (draft === null) {
      return;
    }
    const check = validateAnswer(draft.step, text);
    if (!check.ok) {
      await this._api.sendMessage(chatId, check.error);
      return;
    }
    const updated = this._drafts.advance(chatId, check.value);
    if (updated === null) {
      return;
    }
    if (!this._drafts.isComplete(updated)) {
      await this._api.sendMessage(chatId, QUESTIONS[updated.step]);
      return;
    }
    // Последний шаг записан — отправляем владельцу и забываем черновик.
    await this._submit(chatId, updated.answers);
  }

  /**
   * Создаёт заявку и отправляет карточку владельцу.
   *
   * **Порядок именно такой:** сначала строка в БД (чтобы у кнопок был `id`), потом сообщение
   * владельцу. Если отправка не удалась, заявка помечается протухшей — иначе человек ждал бы
   * решения по заявке, которой владелец никогда не видел.
   * @param chatId Чат заявителя.
   * @param answers Собранные ответы.
   * @returns Промис завершения.
   */
  private async _submit(chatId: string, answers: Record<string, string | undefined>): Promise<void> {
    const id = generateId();
    try {
      await this._repository.createRequest(id, {
        chatId,
        type: 'join',
        status: 'pending',
        accountId: null,
        inviteCodeId: null,
        ownerMessageId: null,
        decisionReason: null,
        decidedAt: null,
      });
    } catch {
      // Сюда попадаем, если уникальный индекс «одна pending на чат» отклонил вставку:
      // человек успел отправить две анкеты подряд.
      this._drafts.forget(chatId);
      await this._api.sendMessage(chatId, 'Похоже, заявка от тебя уже есть. Дождись решения.');
      return;
    }

    const card = [
      '<b>Новая заявка на вступление</b>',
      '',
      `Имя: ${escapeHtml(answers['name'] ?? '—')}`,
      `Возраст: ${escapeHtml(answers['age'] ?? '—')}`,
      `Пол: ${escapeHtml(answers['gender'] ?? '—')}`,
      '',
      `Зачем: ${escapeHtml(answers['why'] ?? '—')}`,
    ].join('\n');

    const messageId =
      this._ownerChatId === ''
        ? null
        : await this._api.sendMessage(this._ownerChatId, card, [
            [
              { text: '✅ Выдать код', callbackData: `ok:${id}` },
              { text: '✖️ Отказать', callbackData: `no:${id}` },
            ],
          ]);

    this._drafts.forget(chatId);

    if (messageId === null) {
      await this._repository.decideIfPending(id, {
        status: 'expired',
        decisionReason: 'Не доставлено владельцу',
        inviteCodeId: null,
      });
      this._logger.warn(`Заявка ${id} не доставлена владельцу — помечена протухшей.`);
      await this._api.sendMessage(
        chatId,
        'Не получилось отправить заявку — попробуй ещё раз чуть позже: /join',
      );
      return;
    }

    await this._repository.setRequestOwnerMessage(id, messageId);
    await this._api.sendMessage(
      chatId,
      'Заявка отправлена. Владелец посмотрит и я напишу сюда с решением.',
    );
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
