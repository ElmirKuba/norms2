import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TelegramApiPort, TelegramButton } from '../adapters/telegram-api.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { RequestDraftStore } from './request-draft.store';
import { INVITES_NOTICE, PRIVACY_NOTICE, QUESTIONS, validateAnswer } from './request-dialog.util';
import type { Env } from '../../../system/config/env.schema';
import type { TelegramRequestType } from '../interfaces/telegram-request-pure.interface';

/**
 * Экранирует текст под HTML-разметку Telegram.
 *
 * Обязательно там, где в сообщение подставляется написанное человеком: пришлёт `<b>` или `&` —
 * Telegram отклонит сообщение целиком, и оно просто не дойдёт.
 * @param text Произвольный текст.
 * @returns Безопасный фрагмент.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Кнопки решения под карточкой заявки.
 *
 * `callback_data` ограничен **64 байтами**, а наш `id` занимает 52 символа — на префикс
 * остаётся 12. Отсюда короткие `ok:` и `no:`.
 * @param requestId Заявка.
 * @returns Ряды кнопок.
 */
export function decisionButtons(requestId: string): TelegramButton[][] {
  return [
    [
      { text: '✅ Выдать код', callbackData: `ok:${requestId}` },
      { text: '✖️ Отказать', callbackData: `no:${requestId}` },
    ],
  ];
}

/**
 * Кнопки под просьбой о приглашениях: сколько выдать или отказать.
 *
 * Номиналы `+1 / +3 / +5` — решение Elmir 04.08.2026. Свободного ввода числа нет намеренно:
 * выдача приглашений — это раздача доступа, и три предсказуемых шага лучше поля, куда в спешке
 * вводится лишний ноль.
 * @param requestId Заявка.
 * @returns Ряды кнопок.
 */
export function grantButtons(requestId: string): TelegramButton[][] {
  return [
    [
      { text: '+1', callbackData: `g1:${requestId}` },
      { text: '+3', callbackData: `g3:${requestId}` },
      { text: '+5', callbackData: `g5:${requestId}` },
    ],
    [{ text: '✖️ Отказать', callbackData: `no:${requestId}` }],
  ];
}

/**
 * Собирает карточку заявки для владельца.
 * @param answers Ответы анкеты.
 * @returns HTML-текст карточки.
 */
export function renderRequestCard(answers: Record<string, string | undefined>): string {
  return [
    '<b>Новая заявка на вступление</b>',
    '',
    `Имя: ${escapeHtml(answers['name'] ?? '—')}`,
    `Возраст: ${escapeHtml(answers['age'] ?? '—')}`,
    `Пол: ${escapeHtml(answers['gender'] ?? '—')}`,
    '',
    `Зачем: ${escapeHtml(answers['why'] ?? '—')}`,
  ].join('\n');
}

/**
 * Собирает карточку просьбы о приглашениях.
 * @param login Логин привязанного аккаунта.
 * @param remaining Сколько приглашений у него осталось.
 * @param purpose Что человек написал.
 * @returns HTML-текст карточки.
 */
export function renderInvitesCard(login: string, remaining: number, purpose: string): string {
  return [
    '<b>Просьба о приглашениях</b>',
    '',
    `От: @${escapeHtml(login)} (осталось: ${String(remaining)})`,
    '',
    `Зачем: ${escapeHtml(purpose)}`,
  ].join('\n');
}

/** Меню гостя — кнопками, а не командами: человек не должен запоминать `/join`. */
const GUEST_MENU: TelegramButton[][] = [
  [{ text: '🎟 Вступить в «Нормисы»', callbackData: 'join' }],
  [{ text: '➕ Получить приглашения', callbackData: 'invites' }],
];

/**
 * Чем закончился разбор сообщения или кнопки гостя.
 *
 * Гостевой сценарий ведёт domain-service, но просьба о приглашениях упирается в **чужую область**
 * (логин и квота аккаунта), а кросс-доменные вызовы живут в use-case (CLAUDE.md, правила
 * зависимостей). Поэтому domain-service не делает эту часть сам, а сообщает наверх, что от него
 * хотят, — и use-case дозванивает до `account`.
 */
export type GuestOutcome =
  /** Всё сделано здесь же, наверху делать нечего. */
  | { type: 'handled' }
  /** Человек нажал «Получить приглашения» — нужен его аккаунт. */
  | { type: 'invitesRequested' }
  /** Анкета на приглашения дособрана — нужно отправить карточку владельцу. */
  | { type: 'invitesReady'; purpose: string };

/** Тексты, не зависящие от шага диалога. */
const REPLY = {
  guestGreeting: [
    '<b>Нормисы</b> — площадка по приглашениям: без рекламы, без слежки, только свои.',
    '',
    'Выбери, что нужно.',
  ].join('\n'),
  unknown: 'Не понял. Нажми /start — покажу меню.',
  alreadyPending: 'У тебя уже есть заявка на рассмотрении. Я напишу, как только будет решение.',
  needText: 'Мне нужен текст — картинки и стикеры я не понимаю.',
  cancelled: 'Заполнение прервано. Захочешь вернуться — нажми /start.',
} as const;

/**
 * Domain-service Telegram-области: **гостевая** часть — меню и пошаговая анкета (2.9.1·9–·10).
 *
 * Сценарий владельца сюда не входит намеренно: он выдаёт приглашения, то есть ходит в чужую
 * область (`invites`, `account`), а кросс-доменные вызовы живут в use-case, не в domain-service
 * (CLAUDE.md, правила зависимостей). Здесь только то, что область умеет сама.
 *
 * ⚠️ **Тело апдейта не логируется никогда** — там имя, возраст и «зачем»
 * ([ADR-0064 §10](../../../../docs/decisions/0064-telegram-release-channel.md)).
 */
@Injectable()
export class TelegramDomainService {
  private readonly _logger = new Logger('Telegram');
  private readonly _ownerChatId: string;

  /**
   * @param _repository Порт репозитория заявок.
   * @param _api Исходящий порт Bot API.
   * @param _drafts Черновики анкет (в памяти процесса).
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

  /** Чат владельца из конфига (пусто — владелец не настроен). */
  public get ownerChatId(): string {
    return this._ownerChatId;
  }

  /**
   * Владелец ли пишет. Проверяется **до разбора команды**: бот умеет выдавать приглашения, и
   * если сверять автора после разбора, любой, кто дотянется до вебхука, выдаст их себе
   * ([ADR-0064 §2a](../../../../docs/decisions/0064-telegram-release-channel.md)).
   * @param chatId Чат.
   * @returns Признак владельца.
   */
  public isOwner(chatId: string): boolean {
    return this._ownerChatId !== '' && chatId === this._ownerChatId;
  }

  /**
   * Отмечает апдейт обработанным (защита от повторной доставки).
   * @param updateId `update_id` из Bot API.
   * @returns `true`, если апдейт видим впервые.
   */
  public async consumeUpdate(updateId: number): Promise<boolean> {
    const first = await this._repository.markUpdateProcessed(updateId);
    if (!first) {
      this._logger.log(`Апдейт ${String(updateId)} уже обработан — повтор пропущен.`);
    }
    return first;
  }

  /**
   * Показывает гостевое меню.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async sendGuestMenu(chatId: string): Promise<void> {
    await this._api.sendMessage(chatId, REPLY.guestGreeting, GUEST_MENU);
  }

  /**
   * Разбирает сообщение гостя: команды, ответы анкеты, всё остальное.
   * @param chatId Чат.
   * @param text Текст (undefined у стикеров и фото).
   * @returns Промис завершения.
   */
  public async handleGuestMessage(chatId: string, text: string | undefined): Promise<GuestOutcome> {
    if (text === undefined) {
      await this._api.sendMessage(chatId, REPLY.needText);
      return { type: 'handled' };
    }
    const command = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';

    if (command === '/start') {
      this._drafts.forget(chatId);
      await this.sendGuestMenu(chatId);
      return { type: 'handled' };
    }
    // `/cancel` проверяется РАНЬШЕ ответов анкеты: иначе, набранный на шаге «зачем тебе
    // Нормисы», он стал бы ответом на вопрос, а не отменой.
    if (command === '/cancel') {
      this._drafts.forget(chatId);
      await this._api.sendMessage(chatId, REPLY.cancelled);
      return { type: 'handled' };
    }
    if (this._drafts.get(chatId) !== null) {
      return this._continueDraft(chatId, text);
    }
    await this._api.sendMessage(chatId, REPLY.unknown);
    return { type: 'handled' };
  }

  /**
   * Разбирает нажатие кнопки гостя.
   * @param chatId Чат.
   * @param data Данные кнопки.
   * @returns Промис завершения.
   */
  public async handleGuestCallback(chatId: string, data: string | undefined): Promise<GuestOutcome> {
    if (data === 'join') {
      await this.startJoin(chatId);
      return { type: 'handled' };
    }
    if (data === 'invites') {
      // Дальше нужен аккаунт заявителя — это чужая область, доводит use-case.
      return { type: 'invitesRequested' };
    }
    await this.sendGuestMenu(chatId);
    return { type: 'handled' };
  }

  /**
   * Начинает анкету, если у чата нет незакрытой заявки.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async startJoin(chatId: string): Promise<void> {
    const pending = await this._repository.findPendingByChat(chatId);
    if (pending !== null) {
      await this._api.sendMessage(chatId, REPLY.alreadyPending);
      return;
    }
    this._drafts.start(chatId, 'join');
    await this._api.sendMessage(chatId, PRIVACY_NOTICE);
    await this._api.sendMessage(chatId, QUESTIONS.name);
  }

  /**
   * Начинает анкету на дополнительные приглашения — **один вопрос вместо четырёх**.
   *
   * Аккаунт заявителя к этому моменту уже проверен вызывающим use-case: спрашивать «зачем», а
   * потом выяснять, что начислять некому, — значит впустую собрать чужой текст.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async startInvites(chatId: string): Promise<void> {
    const pending = await this._repository.findPendingByChat(chatId);
    if (pending !== null) {
      await this._api.sendMessage(chatId, REPLY.alreadyPending);
      return;
    }
    this._drafts.start(chatId, 'more_invites');
    await this._api.sendMessage(chatId, INVITES_NOTICE);
    await this._api.sendMessage(chatId, QUESTIONS.purpose);
  }

  /**
   * Принимает ответ на текущий вопрос анкеты.
   * @param chatId Чат.
   * @param text Ответ.
   * @returns Исход: у `join` заявка уходит здесь же, у `more_invites` — наверх, в use-case.
   */
  private async _continueDraft(chatId: string, text: string): Promise<GuestOutcome> {
    const draft = this._drafts.get(chatId);
    if (draft === null) {
      return { type: 'handled' };
    }
    const check = validateAnswer(draft.step, text);
    if (!check.ok) {
      await this._api.sendMessage(chatId, check.error);
      return { type: 'handled' };
    }
    const updated = this._drafts.advance(chatId, check.value);
    if (updated === null) {
      return { type: 'handled' };
    }
    if (!this._drafts.isComplete(updated)) {
      await this._api.sendMessage(chatId, QUESTIONS[updated.step]);
      return { type: 'handled' };
    }
    if (updated.kind === 'more_invites') {
      // Черновик забываем только здесь: карточку соберёт use-case, но текст ему уже отдан.
      const purpose = updated.answers.purpose ?? '';
      this._drafts.forget(chatId);
      return { type: 'invitesReady', purpose };
    }
    await this._submit(chatId, updated.answers);
    return { type: 'handled' };
  }

  /**
   * Создаёт заявку и отправляет карточку владельцу.
   *
   * **Порядок именно такой:** сначала строка в БД (у кнопок должен быть `id`), потом сообщение
   * владельцу. Не доставили — заявка помечается протухшей: иначе человек ждал бы решения по
   * заявке, которой владелец никогда не видел.
   * @param chatId Чат заявителя.
   * @param answers Собранные ответы.
   * @returns Промис завершения.
   */
  private async _submit(
    chatId: string,
    answers: Record<string, string | undefined>,
  ): Promise<void> {
    await this.submitRequest({
      chatId,
      type: 'join',
      accountId: null,
      cardText: renderRequestCard(answers),
      buttons: decisionButtons,
    });
    this._drafts.forget(chatId);
  }

  /**
   * Создаёт заявку и доставляет карточку владельцу — общий финал обоих сценариев.
   *
   * **Порядок именно такой:** сначала строка в БД (у кнопок должен быть `id`), потом сообщение
   * владельцу. Не доставили — заявка помечается протухшей: иначе человек ждал бы решения по
   * заявке, которой владелец никогда не видел.
   *
   * Текст карточки готовит вызывающий: у просьбы о приглашениях в неё входят логин и остаток
   * квоты, то есть чужая область, — сюда она приезжает уже собранной строкой.
   * @param params Чат, тип, аккаунт, готовый текст карточки и сборщик кнопок по id заявки.
   * @returns `true`, если заявка создана и доставлена владельцу.
   */
  public async submitRequest(params: {
    chatId: string;
    type: TelegramRequestType;
    accountId: string | null;
    cardText: string;
    buttons: (requestId: string) => TelegramButton[][];
  }): Promise<boolean> {
    const { chatId, type, accountId, cardText, buttons } = params;
    const id = generateId();
    try {
      await this._repository.createRequest(id, {
        chatId,
        type,
        status: 'pending',
        accountId,
        inviteCodeId: null,
        grantedAmount: null,
        ownerMessageId: null,
        decisionReason: null,
        decidedAt: null,
      });
    } catch {
      // Сработал уникальный индекс «одна pending на чат»: человек отправил две анкеты подряд.
      await this._api.sendMessage(chatId, REPLY.alreadyPending);
      return false;
    }

    const messageId =
      this._ownerChatId === ''
        ? null
        : await this._api.sendMessage(this._ownerChatId, cardText, buttons(id));

    if (messageId === null) {
      await this._repository.decideIfPending(id, {
        status: 'expired',
        decisionReason: 'Не доставлено владельцу',
        inviteCodeId: null,
        grantedAmount: null,
      });
      this._logger.warn(`Заявка ${id} не доставлена владельцу — помечена протухшей.`);
      await this._api.sendMessage(
        chatId,
        'Не получилось отправить заявку — попробуй ещё раз чуть позже: /start',
      );
      return false;
    }

    await this._repository.setRequestOwnerMessage(id, messageId);
    await this._api.sendMessage(
      chatId,
      'Заявка отправлена. Владелец посмотрит и я напишу сюда с решением.',
    );
    return true;
  }
}
