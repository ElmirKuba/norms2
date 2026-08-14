import { Inject, Injectable, Logger } from '@nestjs/common';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import { ADMIN_AUDIENCE } from '../adapters/admin-audience.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TelegramApiPort, TelegramButton } from '../adapters/telegram-api.port';
import type { AdminAudiencePort } from '../adapters/admin-audience.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { RequestDraftStore } from './request-draft.store';
import { INVITES_NOTICE, UNBAN_NOTICE, PRIVACY_NOTICE, QUESTIONS, validateAnswer } from './request-dialog.util';
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
 * Собирает карточку заявки для админа.
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

/**
 * Что бот знает о собеседнике к моменту показа меню (2.9.3, реш. Elmir 14.08.2026).
 *
 * Собирает его **use-case**: логин и баны — чужие области, domain-service туда не ходит.
 */
export interface ChatContext {
  /** Логин привязанного аккаунта или `null` — чат ничей. */
  login: string | null;
  /** Активные баны на этом аккаунте: кто и за что. Пусто — доступ открыт. */
  bans: readonly { bannerLogin: string; reason: string }[];
}

/**
 * Меню зависит от того, кто по ту сторону.
 *
 * **Привязанному не предлагаем «Вступить»** (замечание Elmir 14.08.2026): он уже внутри, и
 * кнопка звала бы его подать заявку на то, что у него есть, — а админ увидел бы эту заявку в
 * очереди и не понял бы, что с ней делать. **«Меня забанили» показываем только забаненному:**
 * остальным она предлагает решать несуществующую проблему.
 * @param context Что известно о чате.
 * @returns Раскладка кнопок.
 */
function guestMenu(context: ChatContext): TelegramButton[][] {
  const buttons: TelegramButton[][] = [];
  if (context.login === null) {
    buttons.push([{ text: '🎟 Вступить в «Нормисы»', callbackData: 'join' }]);
  }
  buttons.push([{ text: '➕ Получить приглашения', callbackData: 'invites' }]);
  if (context.bans.length > 0) {
    buttons.push([{ text: '🔓 Попросить снять бан', callbackData: 'unban' }]);
  } else if (context.login === null) {
    // Чат ничей: человек может быть забанен под своим логином, а бот об этом не знает.
    buttons.push([{ text: '🔓 Меня забанили', callbackData: 'unban' }]);
  }
  return buttons;
}

/**
 * Строка состояния над меню: кто ты и открыт ли доступ.
 *
 * До 2.9.3 бот не говорил об этом ничего, и человек, привязавший чат, видел то же меню, что
 * посторонний. Забаненный — тем более: он узнавал о бане только на экране входа.
 * @param context Что известно о чате.
 * @returns Текст приветствия.
 */
function guestGreeting(context: ChatContext): string {
  const lines = [
    '<b>Нормисы</b> — площадка по приглашениям: без рекламы, без слежки, только свои.',
    '',
  ];
  if (context.login === null) {
    lines.push('Этот чат пока ни к кому не привязан. Выбери, что нужно.');
    return lines.join('\n');
  }

  lines.push(`Чат привязан к аккаунту <b>@${escapeHtml(context.login)}</b>.`);
  if (context.bans.length === 0) {
    lines.push('', '✅ Активных банов нет — вход открыт.');
    return lines.join('\n');
  }
  lines.push('', '⛔️ <b>Доступ закрыт.</b>');
  for (const ban of context.bans) {
    lines.push(`• @${escapeHtml(ban.bannerLogin)}: ${escapeHtml(ban.reason)}`);
  }
  lines.push('', 'Считаешь, что это ошибка, — нажми «Попросить снять бан».');
  return lines.join('\n');
}

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
  /** Анкета на приглашения дособрана — нужно отправить карточку админу. */
  | { type: 'invitesReady'; purpose: string }
  /** Просьба о разбане дособрана: логин и объяснение «почему стоит вернуть». */
  | { type: 'unbanReady'; login: string; appeal: string };

/** Тексты, не зависящие от шага диалога. */
const REPLY = {
  unknown: 'Не понял. Нажми /start — покажу меню.',
  alreadyPending: 'У тебя уже есть заявка на рассмотрении. Я напишу, как только будет решение.',
  needText: 'Мне нужен текст — картинки и стикеры я не понимаю.',
  cancelled: 'Заполнение прервано. Захочешь вернуться — нажми /start.',
} as const;

/**
 * Domain-service Telegram-области: **гостевая** часть — меню и пошаговая анкета (2.9.1·9–·10).
 *
 * Сценарий админа сюда не входит намеренно: он выдаёт приглашения, то есть ходит в чужую
 * область (`invites`, `account`), а кросс-доменные вызовы живут в use-case, не в domain-service
 * (CLAUDE.md, правила зависимостей). Здесь только то, что область умеет сама.
 *
 * ⚠️ **Тело апдейта не логируется никогда** — там имя, возраст и «зачем»
 * ([ADR-0064 §10](../../../../docs/decisions/0064-telegram-release-channel.md)).
 */
@Injectable()
export class TelegramDomainService {
  private readonly _logger = new Logger('Telegram');

  /**
   * @param _repository Порт репозитория заявок.
   * @param _api Исходящий порт Bot API.
   * @param _drafts Черновики анкет (в памяти процесса).
   * @param _audience Порт «кто здесь админ» (2.9.3·3а).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _drafts: RequestDraftStore,
    @Inject(ADMIN_AUDIENCE) private readonly _audience: AdminAudiencePort,
  ) {}

  /**
   * Админ ли пишет. Проверяется **до разбора команды**: бот умеет выдавать приглашения, и если
   * сверять автора после разбора, любой, кто дотянется до вебхука, выдаст их себе
   * ([ADR-0064 §2a](../../../../docs/decisions/0064-telegram-release-channel.md)).
   *
   * **Права берутся у аккаунта, а не из конфига** (2.9.3·3а): `TELEGRAM_OWNER_CHAT_ID` убран
   * совсем — переменная, которая ничего не решает, но выглядит как рычаг, опаснее её отсутствия.
   *
   * @param chatId Чат.
   * @returns Признак админа.
   */
  public async isAdmin(chatId: string): Promise<boolean> {
    return this._audience.isAdminChat(chatId);
  }

  /**
   * Чей это чат — идентификатор привязанного аккаунта или `null`.
   *
   * Логин и баны по нему достаёт use-case: они живут в чужих областях.
   * @param chatId Чат.
   * @returns Идентификатор аккаунта или null.
   */
  public async findAccountByChat(chatId: string): Promise<string | null> {
    const link = await this._repository.findLinkByChat(chatId);
    return link?.accountId ?? null;
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
   * Спрашивает согласие на уведомления у того, кто только что зарегистрировался по коду из
   * заявки (·15).
   *
   * **Спрашиваем явно и отдельно.** Человек писал боту, чтобы попасть внутрь, а не чтобы
   * получать сообщения; молча превратить одно согласие в другое нельзя
   * ([ADR-0064 §12](../../../../docs/decisions/0064-telegram-release-channel.md)).
   *
   * Заодно создаётся сама привязка: цепочка «заявка из этого чата → выданный в него код →
   * регистрация по нему» уже доказывает, что чат принадлежит человеку, и заставлять его
   * переписывать код из ЛК было бы бессмысленной формальностью. Привязка создаётся с
   * `notifications_allowed = false` — согласие включит только кнопка.
   *
   * **Чат передаётся снаружи, а не ищется по коду.** Погашение кода при регистрации удаляет его
   * строку, а ссылка на неё в заявке обнуляется (`ON DELETE SET NULL`), — искать задним числом
   * уже нечего (поймано живым прогоном 05.08.2026).
   * @param chatId Чат заявителя, найденный до регистрации.
   * @param accountId Созданный аккаунт.
   * @returns Промис завершения.
   */
  public async askNotificationsConsent(chatId: string, accountId: string): Promise<void> {
    const existing = await this._repository.findLinkByChat(chatId);
    if (existing === null && (await this._repository.findLinkByAccount(accountId)) === null) {
      await this._repository.createLink(generateId(), accountId, chatId);
    }
    await this._api.sendMessage(
      chatId,
      [
        '🎉 <b>Ты в «Нормисах».</b>',
        '',
        'Оставить эту переписку для уведомлений? Тогда я смогу написать сюда о важном — например, о новом релизе.',
        '',
        'Откажешься — ничего не потеряешь: заявки и приглашения работают и без этого.',
      ].join('\n'),
      [
        [
          { text: '✅ Да, можно писать', callbackData: 'nt:1' },
          { text: '✖️ Нет, спасибо', callbackData: 'nt:0' },
        ],
      ],
    );
  }

  /**
   * Чат заявки, по которой был выдан этот код (до его погашения).
   * @param inviteCodeId Идентификатор кода.
   * @returns Чат или null, если код выдан не через бота.
   */
  public async findRequestChatByInviteCode(inviteCodeId: string): Promise<string | null> {
    const request = await this._repository.findRequestByInviteCode(inviteCodeId);
    return request?.chatId ?? null;
  }

  /**
   * Записывает ответ на вопрос об уведомлениях.
   * @param chatId Чат.
   * @param allowed Разрешил ли писать.
   * @returns Промис завершения.
   */
  public async setNotificationsConsent(chatId: string, allowed: boolean): Promise<void> {
    const link = await this._repository.findLinkByChat(chatId);
    if (link === null) {
      await this._api.sendMessage(chatId, 'Этот чат не привязан к аккаунту — записывать согласие не к чему.');
      return;
    }
    await this._repository.setNotificationsAllowed(chatId, allowed);
    await this._api.sendMessage(
      chatId,
      allowed
        ? 'Договорились — буду писать только о важном. Передумаешь: /unlink отвяжет чат целиком.'
        : 'Понял, писать не буду. Заявки и приглашения работают по-прежнему.',
    );
  }

  /**
   * Показывает гостевое меню.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async sendGuestMenu(chatId: string, context: ChatContext): Promise<void> {
    await this._api.sendMessage(chatId, guestGreeting(context), guestMenu(context));
  }

  /**
   * Разбирает сообщение гостя: команды, ответы анкеты, всё остальное.
   * @param chatId Чат.
   * @param text Текст (undefined у стикеров и фото).
   * @returns Промис завершения.
   */
  public async handleGuestMessage(
    chatId: string,
    text: string | undefined,
    context: ChatContext,
  ): Promise<GuestOutcome> {
    if (text === undefined) {
      await this._api.sendMessage(chatId, REPLY.needText);
      return { type: 'handled' };
    }
    const command = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';

    // `/menu` — синоним `/start` (2.9.3, поймано Elmir 14.08.2026). Команда объявлена в списке
    // Telegram для **всех**, но обрабатывалась только у админа: обычный человек получал «не
    // понял, нажми /start». Ровно та болезнь, ради которой список команд и переехал из BotFather
    // в код, — просто разъехались не список с обработчиком, а две ветки обработчика.
    if (command === '/start' || command === '/menu') {
      this._drafts.forget(chatId);
      await this.sendGuestMenu(chatId, context);
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
   * Отправляет человеку сообщение в его чат — короткий путь для use-case, которому нужно только
   * ответить, а не вести диалог.
   * @param chatId Чат.
   * @param text Текст (HTML).
   * @returns Промис завершения.
   */
  public async reply(chatId: string, text: string): Promise<void> {
    await this._api.sendMessage(chatId, text);
  }

  /**
   * Пишет админу аккаунта, если он привязал Telegram (2.9.3·22).
   *
   * **Согласие на уведомления здесь не спрашивается намеренно.** Оно про сообщения продукта —
   * вехи, новости; а закрытый или открытый доступ это не рассылка, а факт, без которого человек
   * упирается в «вы забанены» без единого объяснения. Остановил бота — сообщение не дойдёт, и
   * это его выбор: добиваться доставки продукт не будет.
   * @param accountId Кому.
   * @param text Текст (HTML).
   * @returns `true`, если было куда писать.
   */
  public async notifyAccount(accountId: string, text: string): Promise<boolean> {
    const link = await this._repository.findLinkByAccount(accountId);
    if (link === null) {
      return false;
    }
    await this._api.sendMessage(link.chatId, text);
    return true;
  }

  /**
   * Разбирает нажатие кнопки гостя.
   * @param chatId Чат.
   * @param data Данные кнопки.
   * @returns Промис завершения.
   */
  public async handleGuestCallback(
    chatId: string,
    data: string | undefined,
    context: ChatContext,
  ): Promise<GuestOutcome> {
    if (data === 'join') {
      await this.startJoin(chatId);
      return { type: 'handled' };
    }
    if (data === 'invites') {
      // Дальше нужен аккаунт заявителя — это чужая область, доводит use-case.
      return { type: 'invitesRequested' };
    }
    if (data === 'unban') {
      // Чат привязан — логин мы уже знаем, и спрашивать его заново было бы издевательством.
      // Но и подставлять молча нельзя: человек может просить за другого (реш. Elmir 14.08.2026).
      if (context.login !== null) {
        await this._api.sendMessage(
          chatId,
          `Просишь за себя — <b>@${escapeHtml(context.login)}</b>?`,
          [
            [{ text: '✅ Да, это я', callbackData: 'unban_self' }],
            [{ text: '✏️ Нет, другой логин', callbackData: 'unban_other' }],
          ],
        );
        return { type: 'handled' };
      }
      await this.startUnban(chatId);
      return { type: 'handled' };
    }
    if (data === 'unban_self' && context.login !== null) {
      // Логин известен — остаётся объяснение: без него заявка приходит пустой и решать по ней
      // нечего (замечание Elmir 14.08.2026).
      this._drafts.start(chatId, 'unban', { login: context.login });
      await this._api.sendMessage(chatId, QUESTIONS.appeal);
      return { type: 'handled' };
    }
    if (data === 'unban_other') {
      await this.startUnban(chatId);
      return { type: 'handled' };
    }
    await this.sendGuestMenu(chatId, context);
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
   * Начинает просьбу о снятии бана — **один вопрос, логин** (2.9.3·22).
   *
   * Причину не спрашиваем: она уже записана тем, кто банил, и решение принимают по ней, а не по
   * версии забаненного. Проверить, существует ли такой аккаунт и правда ли он забанен, здесь
   * нельзя — это чужая область, и доводит её use-case.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async startUnban(chatId: string): Promise<void> {
    const pending = await this._repository.findPendingByChat(chatId);
    if (pending !== null) {
      await this._api.sendMessage(chatId, REPLY.alreadyPending);
      return;
    }
    this._drafts.start(chatId, 'unban');
    await this._api.sendMessage(chatId, UNBAN_NOTICE);
    await this._api.sendMessage(chatId, QUESTIONS.login);
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
    if (updated.kind === 'unban') {
      const login = updated.answers.login ?? '';
      const appeal = updated.answers.appeal ?? '';
      this._drafts.forget(chatId);
      return { type: 'unbanReady', login, appeal };
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
   * Создаёт заявку и отправляет карточку админу.
   *
   * **Порядок именно такой:** сначала строка в БД (у кнопок должен быть `id`), потом сообщение
   * админу. Не доставили — заявка помечается протухшей: иначе человек ждал бы решения по
   * заявке, которой админ никогда не видел.
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
   * Создаёт заявку и доставляет карточку админу — общий финал обоих сценариев.
   *
   * **Порядок именно такой:** сначала строка в БД (у кнопок должен быть `id`), потом сообщение
   * админу. Не доставили — заявка помечается протухшей: иначе человек ждал бы решения по
   * заявке, которой админ никогда не видел.
   *
   * Текст карточки готовит вызывающий: у просьбы о приглашениях в неё входят логин и остаток
   * квоты, то есть чужая область, — сюда она приезжает уже собранной строкой.
   * @param params Чат, тип, аккаунт, готовый текст карточки и сборщик кнопок по id заявки.
   * @returns `true`, если заявка создана и доставлена админу.
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

    // Карточка уходит ВСЕМ админам, привязавшим Telegram (2.9.3·3а), а не в один чат из
    // конфига: админов может быть несколько, и заявка не должна зависеть от того, смотрит ли
    // сейчас в бот конкретный человек. Пустой список — админов с привязкой нет; это штатное
    // состояние (аварийного люка мы не делали), но заявку тогда некому показать.
    const adminChatIds = await this._audience.adminChatIds();
    let messageId: number | null = null;
    for (const adminChatId of adminChatIds) {
      const sent = await this._api.sendMessage(adminChatId, cardText, buttons(id));
      // Запоминается id ПЕРВОЙ удавшейся доставки: колонка одна, и по ней потом правится
      // карточка после решения. У остальных админов карточка останется в исходном виде —
      // цена принята, вариант «колонка на каждого админа» не стоит своей сложности при трёх
      // людях. Записано хвостом.
      messageId ??= sent;
    }

    if (messageId === null) {
      await this._repository.decideIfPending(id, {
        status: 'expired',
        decisionReason: 'Не доставлено администратору',
        inviteCodeId: null,
        grantedAmount: null,
      });
      this._logger.warn(`Заявка ${id} не доставлена администратору — помечена протухшей.`);
      await this._api.sendMessage(
        chatId,
        'Не получилось отправить заявку — попробуй ещё раз чуть позже: /start',
      );
      return false;
    }

    await this._repository.setRequestOwnerMessage(id, messageId);
    await this._api.sendMessage(
      chatId,
      'Заявка отправлена. Админ посмотрит и я напишу сюда с решением.',
    );
    return true;
  }
}
