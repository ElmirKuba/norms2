import { Inject, Injectable, Logger } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { AdminActionStore } from '../domain-services/admin-action.store';
import { ReviewRequestsUseCase } from './review-requests.use-case';
import { RequestDecisionError } from '../../../shared/errors/request-decision.error';
import type { RequestDecisionFailure } from '../../../shared/errors/request-decision.error';
import {
  decisionButtons,
  escapeHtml,
  grantButtons,
} from '../domain-services/telegram.domain-service';
import type { TelegramApiPort, TelegramButton } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TelegramRequestFull } from '../interfaces/telegram-request-full.interface';
import type { AdminActionKind } from '../domain-services/admin-action.store';
import type { RequestActor } from '../interfaces/request-actor.interface';

/** Возврат в меню — есть на каждом экране: без него любой список тупик. */
const MENU_BUTTON = { text: '🏠 Меню', callbackData: 'menu' };

/** Сколько заявок показываем на странице очереди. */
const PAGE_SIZE = 5;

/** Причина по умолчанию, если админ поставил прочерк. */
const DEFAULT_REASON = 'По заявке через бота';

/** Что админ пишет, чтобы оставить причину пустой. */
const SKIP_REASON = '-';

/**
 * Сценарий админа: меню, очередь заявок, решения и выдача кода (2.9.1·11–·12).
 *
 * **Почему use-case, а не domain-service.** Выдача приглашения — это чужие области: списать
 * квоту у `account`, создать код в `invites`. Кросс-доменные вызовы идут только вниз и только
 * из use-case (CLAUDE.md); domain-service Telegram-области про приглашения не знает вовсе.
 *
 * **Все методы предполагают, что автор уже проверен.** Проверка роли (2.9.3·3а: привязанный
 * аккаунт с ролью `admin`) происходит выше по стеку, до разбора команды — здесь её нет
 * намеренно, чтобы не создавать впечатление, будто проверка бывает необязательной.
 */
@Injectable()
export class AdminActionsUseCase {
  private readonly _logger = new Logger('TelegramOwner');

  /**
   * @param _repository Порт репозитория заявок.
   * @param _api Исходящий порт Bot API.
   * @param _pending Незавершённые действия админа (ждём причину).
   * @param _accountDomainService Domain-service аккаунтов (аккаунт по идентификатору).
   * @param _review Ядро разбора заявок — **общее с админкой** (2.9.3·11).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _pending: AdminActionStore,
    private readonly _accountDomainService: AccountDomainService,
    private readonly _review: ReviewRequestsUseCase,
  ) {}

  /**
   * Показывает меню админа.
   *
   * **Гостевых кнопок здесь нет** (замечание Elmir 14.08.2026): «Вступить в „Нормисы“» человеку,
   * который уже внутри, предлагает подать заявку на то, что у него есть, — и эта заявка легла бы
   * в очередь к нему же. «Получить приглашения» бессмысленна по той же причине: он их выдаёт.
   *
   * **Заголовок — «админа», а не «админа»:** с 2.9.3·3а права в боте определяет роль
   * аккаунта, а не единственный вшитый `chat_id`, и админов может быть несколько.
   * @param chatId Чат админа.
   * @returns Промис завершения.
   */
  public async sendMenu(chatId: string): Promise<void> {
    const waiting = await this._repository.countRequestsByStatus('pending');
    const linked = await this._repository.findLinkByChat(chatId);
    const menu: TelegramButton[][] = [
      [{ text: `📋 Заявки (${String(waiting)})`, callbackData: 'q:0' }],
      [{ text: '📜 История решений', callbackData: 'h:0' }],
    ];
    const account =
      linked === null ? null : await this._accountDomainService.getActiveById(linked.accountId).catch(() => null);
    const hint =
      account === null
        ? '\n\n⚠️ Аккаунт не привязан — выдать код я не смогу. Возьми код в личном кабинете («Настройки → Telegram») и пришли мне: <code>/link КОД</code>'
        : `\n\nПриглашения выдаются от аккаунта <b>@${escapeHtml(account.login)}</b> (осталось: ${String(account.invitesRemaining)}).`;
    await this._api.sendMessage(chatId, `<b>Меню админа</b>${hint}`, menu);
  }

  /**
   * Показывает страницу очереди заявок или истории решений.
   * @param chatId Чат админа.
   * @param offset Сдвиг страницы.
   * @param history `true` — показать закрытые вместо ожидающих.
   * @returns Промис завершения.
   */
  public async showQueue(chatId: string, offset: number, history: boolean): Promise<void> {
    const status = history ? 'rejected' : 'pending';
    const items = await this._repository.listRequestsByStatus(status, PAGE_SIZE, offset);
    const approved = history
      ? await this._repository.listRequestsByStatus('approved', PAGE_SIZE, offset)
      : [];
    const all = [...items, ...approved].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    if (all.length === 0) {
      await this._api.sendMessage(
        chatId,
        history ? 'Решений пока не было.' : 'Ожидающих заявок нет.',
        [[MENU_BUTTON]],
      );
      return;
    }

    // Кнопка сама себя описывает — дублировать её текстом в списке незачем.
    const buttons: TelegramButton[][] = all.map((request, index) => [
      {
        text: `${String(offset + index + 1)}. ${this._statusIcon(request)} ${this._shortLabel(request)}`,
        callbackData: `c:${request.id}`,
      },
    ]);
    const nav: TelegramButton[] = [];
    if (offset > 0) {
      nav.push({
        text: '← Назад',
        callbackData: `${history ? 'h' : 'q'}:${String(Math.max(0, offset - PAGE_SIZE))}`,
      });
    }
    if (all.length === PAGE_SIZE) {
      nav.push({
        text: 'Дальше →',
        callbackData: `${history ? 'h' : 'q'}:${String(offset + PAGE_SIZE)}`,
      });
    }
    if (nav.length > 0) {
      buttons.push(nav);
    }
    buttons.push([MENU_BUTTON]);
    const title = history ? '<b>История решений</b>' : '<b>Заявки на рассмотрении</b>';
    await this._api.sendMessage(chatId, `${title}\n\nВыбери заявку — покажу её и что с ней можно сделать.`, buttons);
  }

  /**
   * Показывает одну заявку с кнопками решения.
   * @param chatId Чат админа.
   * @param requestId Заявка.
   * @returns Промис завершения.
   */
  public async showCard(chatId: string, requestId: string): Promise<void> {
    const request = await this._repository.findRequestById(requestId);
    if (request === null) {
      await this._api.sendMessage(chatId, 'Заявка не найдена.');
      return;
    }
    // Текста заявки у нас нет — он не хранится (ADR-0064 §10). Зато сохранён id сообщения
    // в этом же чате: пересылаем его сам себе, и админ видит исходную анкету.
    // ВАЖНО: при пересылке Telegram срезает инлайн-кнопки, поэтому действия идут отдельным
    // сообщением следом — иначе карточка приходит «мёртвой» (поймано 05.08.2026).
    if (request.ownerMessageId !== null) {
      await this._api.forwardMessage(chatId, chatId, request.ownerMessageId);
    }
    if (request.status !== 'pending') {
      await this._api.sendMessage(chatId, this._renderClosed(request), [
        [{ text: '◀️ К списку', callbackData: 'h:0' }, MENU_BUTTON],
      ]);
      return;
    }
    // У просьбы о приглашениях свои кнопки: там не код, а номинал начисления.
    const actions =
      request.type === 'more_invites'
        ? grantButtons(request.id)
        : decisionButtons(request.id);
    await this._api.sendMessage(chatId, 'Что делаем с этой заявкой?', [
      ...actions,
      [{ text: '◀️ К списку', callbackData: 'q:0' }, MENU_BUTTON],
    ]);
  }

  /**
   * Запоминает выбранное действие и просит причину.
   * @param chatId Чат админа.
   * @param kind Одобрить или отказать.
   * @param requestId Заявка.
   * @returns Промис завершения.
   */
  public async askReason(chatId: string, kind: AdminActionKind, requestId: string): Promise<void> {
    const request = await this._repository.findRequestById(requestId);
    if (request === null || request.status !== 'pending') {
      await this._api.sendMessage(chatId, 'Эта заявка уже закрыта.');
      return;
    }
    this._pending.start(chatId, kind, requestId, 0);
    const hint =
      kind === 'approve'
        ? [
            'Напиши <b>подпись к приглашению</b> — она останется в дереве приглашений навсегда и её увидит приглашённый.',
            '',
            `⚠️ Не переноси туда данные из заявки. Прочерк <code>${SKIP_REASON}</code> — поставлю «${DEFAULT_REASON}».`,
          ].join('\n')
        : [
            'Напиши <b>причину отказа</b> — я передам её человеку дословно.',
            '',
            `Прочерк <code>${SKIP_REASON}</code> — отправлю без объяснения.`,
          ].join('\n');
    await this._api.sendMessage(chatId, hint, [[{ text: '◀️ Отмена', callbackData: 'cancel' }]]);
  }

  /**
   * Запоминает выбранный номинал и просит подпись к начислению.
   *
   * Причина спрашивается и здесь — ради истории решений: квота в аккаунте станет просто числом,
   * и через месяц по нему не вспомнить, за что дали. Прочерк по-прежнему допустим.
   * @param chatId Чат админа.
   * @param amount Сколько приглашений начислить.
   * @param requestId Заявка.
   * @returns Промис завершения.
   */
  public async askGrantReason(chatId: string, amount: number, requestId: string): Promise<void> {
    const request = await this._repository.findRequestById(requestId);
    if (request === null || request.status !== 'pending') {
      await this._api.sendMessage(chatId, 'Эта заявка уже закрыта.');
      return;
    }
    if (request.type !== 'more_invites') {
      await this._api.sendMessage(chatId, 'Это заявка на вступление — по ней выдаётся код.');
      return;
    }
    this._pending.start(chatId, 'grant', requestId, amount);
    await this._api.sendMessage(
      chatId,
      [
        `Начисляю <b>+${String(amount)}</b>. Напиши, за что — я передам это человеку.`,
        '',
        `Прочерк <code>${SKIP_REASON}</code> — начислю без объяснения.`,
      ].join('\n'),
      [[{ text: '◀️ Отмена', callbackData: 'cancel' }]],
    );
  }

  /**
   * Отменяет начатое действие (кнопка «Отмена» под запросом причины).
   * @param chatId Чат админа.
   * @returns Промис завершения.
   */
  public async cancelPending(chatId: string): Promise<void> {
    this._pending.forget(chatId);
    await this._api.sendMessage(chatId, 'Отменил. Заявка осталась на рассмотрении.', [
      [{ text: '📋 К заявкам', callbackData: 'q:0' }, MENU_BUTTON],
    ]);
  }

  /**
   * Принимает причину и закрывает заявку.
   * @param chatId Чат админа.
   * @param text Написанная причина.
   * @returns `true`, если сообщение было причиной и обработано.
   */
  public async applyReason(chatId: string, text: string): Promise<boolean> {
    const action = this._pending.take(chatId);
    if (action === null) {
      return false;
    }
    const reason = text.trim() === SKIP_REASON ? null : text.trim();
    if (action.kind === 'approve') {
      await this._approve(chatId, action.requestId, reason);
    } else if (action.kind === 'grant') {
      await this._grant(chatId, action.requestId, action.amount, reason);
    } else {
      await this._reject(chatId, action.requestId, reason);
    }
    return true;
  }

  /**
   * Одобряет заявку: списывает квоту, создаёт код, шлёт его человеку.
   *
   * Вся механика — в общем с админкой ядре (`ReviewRequestsUseCase`); здесь остаётся ровно то,
   * что относится к боту: чей это аккаунт и как отчитаться админу в чат.
   * @param chatId Чат админа.
   * @param requestId Заявка.
   * @param reason Подпись к приглашению или null.
   * @returns Промис завершения.
   */
  private async _approve(chatId: string, requestId: string, reason: string | null): Promise<void> {
    const actor = await this._resolveActor(chatId);
    if (actor === null) {
      return;
    }
    try {
      const outcome = await this._review.approve(requestId, actor, reason);
      const code = escapeHtml(outcome.inviteCode ?? '');
      await this._reply(
        chatId,
        outcome.notified
          ? `Код выдан и отправлен: <code>${code}</code>`
          : `Код выдан: <code>${code}</code>\n\n⚠️ Человеку он <b>не доставлен</b> — бот молчит или его заблокировали. Код придётся передать другим способом.`,
      );
    } catch (error) {
      await this._reportFailure(chatId, requestId, error);
    }
  }

  /**
   * Начисляет приглашения по просьбе (·13).
   * @param chatId Чат админа.
   * @param requestId Заявка.
   * @param amount Сколько начислить.
   * @param reason Подпись к начислению или null.
   * @returns Промис завершения.
   */
  private async _grant(
    chatId: string,
    requestId: string,
    amount: number,
    reason: string | null,
  ): Promise<void> {
    const actor = await this._resolveActor(chatId);
    if (actor === null) {
      return;
    }
    try {
      const outcome = await this._review.grant(requestId, actor, amount, reason);
      await this._reply(
        chatId,
        outcome.notified
          ? `Начислено +${String(amount)}.`
          : `Начислено +${String(amount)}.\n\n⚠️ Человеку сообщение <b>не доставлено</b> — квота у него уже есть, но он об этом не знает.`,
      );
    } catch (error) {
      await this._reportFailure(chatId, requestId, error);
    }
  }

  /**
   * Отказывает по заявке.
   * @param chatId Чат админа.
   * @param requestId Заявка.
   * @param reason Причина или null.
   * @returns Промис завершения.
   */
  private async _reject(chatId: string, requestId: string, reason: string | null): Promise<void> {
    const actor = await this._resolveActor(chatId);
    if (actor === null) {
      return;
    }
    try {
      const outcome = await this._review.reject(requestId, actor, reason);
      await this._reply(
        chatId,
        outcome.notified
          ? 'Отказ отправлен.'
          : 'Заявка отклонена.\n\n⚠️ Человеку сообщение <b>не доставлено</b> — он об отказе не знает.',
      );
    } catch (error) {
      await this._reportFailure(chatId, requestId, error);
    }
  }

  /**
   * Определяет, от чьего имени решает админ: чат → привязка → аккаунт.
   *
   * Без привязки решать нельзя: квота приглашений списывается с конкретного аккаунта, а подпись
   * в журнале должна указывать на человека, а не на чат.
   * @param chatId Чат админа.
   * @returns Актёр или null, если привязки нет (сообщение уже отправлено).
   */
  private async _resolveActor(chatId: string): Promise<RequestActor | null> {
    const link = await this._repository.findLinkByChat(chatId);
    if (link === null) {
      await this._api.sendMessage(
        chatId,
        'Сначала привяжи аккаунт — от него будет выдан код: <code>/link мой_логин</code>',
      );
      return null;
    }
    const account = await this._accountDomainService.getActiveById(link.accountId).catch(() => null);
    if (account === null) {
      await this._api.sendMessage(chatId, 'Привязанный аккаунт недоступен — решить заявку нельзя.');
      return null;
    }
    return { accountId: account.id, login: account.login };
  }

  /**
   * Переводит машинный код отказа в реплику админу.
   * @param chatId Чат админа.
   * @param requestId Заявка (для лога).
   * @param error Что произошло.
   * @returns Промис завершения.
   */
  private async _reportFailure(chatId: string, requestId: string, error: unknown): Promise<void> {
    if (!(error instanceof RequestDecisionError)) {
      this._logger.error(`Решение по заявке ${requestId} упало: ${String(error)}`);
      await this._api.sendMessage(chatId, 'Что-то пошло не так — заявка осталась как была.');
      return;
    }
    // Словарь именно `Record<RequestDecisionFailure, …>`, а не `Record<string, …>`: появится
    // новый код отказа — компилятор потребует формулировку, а не выдаст заглушку молча.
    const texts: Record<RequestDecisionFailure, string> = {
      NOT_FOUND: 'Заявка не найдена.',
      ALREADY_CLOSED: 'Эта заявка уже закрыта.',
      QUOTA_EXHAUSTED: 'Квота приглашений исчерпана — код не выдан.',
      NO_ACCOUNT: 'У заявки нет аккаунта — начислять некому.',
      WRONG_TYPE: 'Это заявка на вступление — по ней выдаётся код.',
      CREATE_FAILED: 'Не получилось выполнить решение.',
    };
    await this._api.sendMessage(chatId, texts[error.code]);
  }

  /**
   * Отчёт админу с возвратом к очереди.
   * @param chatId Чат админа.
   * @param text Текст.
   * @returns Промис завершения.
   */
  private async _reply(chatId: string, text: string): Promise<void> {
    await this._api.sendMessage(chatId, text, [
      [{ text: '📋 К заявкам', callbackData: 'q:0' }, MENU_BUTTON],
    ]);
  }

  /**
   * Иконка статуса заявки.
   * @param request Заявка.
   * @returns Эмодзи.
   */
  private _statusIcon(request: TelegramRequestFull): string {
    if (request.status === 'approved') {
      return '✅';
    }
    if (request.status === 'rejected') {
      return '✖️';
    }
    return request.status === 'expired' ? '🕓' : '🟡';
  }

  /**
   * Короткая подпись кнопки заявки.
   * @param request Заявка.
   * @returns Строка вида «вступление · 05.08 13:07».
   */
  private _shortLabel(request: TelegramRequestFull): string {
    const kind = request.type === 'join' ? 'вступление' : 'приглашения';
    const when = request.createdAt.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${kind} · ${when}`;
  }

  /**
   * Строка заявки в списке.
   * @param request Заявка.
   * @param number Порядковый номер.
   * @returns Строка списка.
   */
  private _renderQueueLine(request: TelegramRequestFull, number: number): string {
    return `${String(number)}. ${this._statusIcon(request)} ${this._shortLabel(request)}`;
  }

  /**
   * Описание уже закрытой заявки.
   * @param request Заявка.
   * @returns Текст.
   */
  private _renderClosed(request: TelegramRequestFull): string {
    // У просьбы о приглашениях «одобрена» без числа бессмысленна: через месяц не вспомнить,
    // сколько именно выдал.
    const granted = request.grantedAmount === null ? '' : ` (+${String(request.grantedAmount)})`;
    const what =
      request.status === 'approved'
        ? `Одобрена${granted}`
        : request.status === 'rejected'
          ? 'Отклонена'
          : 'Протухла';
    const reason =
      request.decisionReason === null ? '' : `\nПричина: ${escapeHtml(request.decisionReason)}`;
    return `${what}.${reason}`;
  }
}
