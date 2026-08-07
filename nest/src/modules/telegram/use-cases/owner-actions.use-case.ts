import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../../invites/domain-services/invite.domain-service';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { TRANSACTION_RUNNER } from '../../../shared/transactions/transaction-runner.port';
import { OwnerActionStore } from '../domain-services/owner-action.store';
import {
  decisionButtons,
  escapeHtml,
  grantButtons,
} from '../domain-services/telegram.domain-service';
import type { TelegramApiPort, TelegramButton } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TransactionRunnerPort } from '../../../shared/transactions/transaction-runner.port';
import type { TelegramRequestFull } from '../interfaces/telegram-request-full.interface';
import type { OwnerActionKind } from '../domain-services/owner-action.store';
import type { Env } from '../../../system/config/env.schema';
import { toHumanUrl } from '../../../shared/utility-level/human-url.util';

/** Возврат в меню — есть на каждом экране: без него любой список тупик. */
const MENU_BUTTON = { text: '🏠 Меню', callbackData: 'menu' };

/** Сколько заявок показываем на странице очереди. */
const PAGE_SIZE = 5;

/** Причина по умолчанию, если владелец поставил прочерк. */
const DEFAULT_REASON = 'По заявке через бота';

/** Что владелец пишет, чтобы оставить причину пустой. */
const SKIP_REASON = '-';

/**
 * Сценарий владельца: меню, очередь заявок, решения и выдача кода (2.9.1·11–·12).
 *
 * **Почему use-case, а не domain-service.** Выдача приглашения — это чужие области: списать
 * квоту у `account`, создать код в `invites`. Кросс-доменные вызовы идут только вниз и только
 * из use-case (CLAUDE.md); domain-service Telegram-области про приглашения не знает вовсе.
 *
 * **Все методы предполагают, что автор уже проверен.** Сверка с `TELEGRAM_OWNER_CHAT_ID`
 * происходит выше по стеку, до разбора команды — здесь её нет намеренно, чтобы не создавать
 * впечатление, будто проверка бывает необязательной.
 */
@Injectable()
export class OwnerActionsUseCase {
  private readonly _logger = new Logger('TelegramOwner');
  private readonly _baseUrl: string;

  /**
   * @param _repository Порт репозитория заявок.
   * @param _api Исходящий порт Bot API.
   * @param _pending Незавершённые действия владельца (ждём причину).
   * @param _accountDomainService Domain-service аккаунтов (квота, аккаунт по идентификатору).
   * @param _inviteDomainService Domain-service приглашений (создание кода).
   * @param _transactionRunner Раннер транзакций.
   * @param configService Конфиг (публичный адрес для ссылки-приглашения).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _pending: OwnerActionStore,
    private readonly _accountDomainService: AccountDomainService,
    private readonly _inviteDomainService: InviteDomainService,
    @Inject(TRANSACTION_RUNNER) private readonly _transactionRunner: TransactionRunnerPort,
    configService: ConfigService<Env, true>,
  ) {
    this._baseUrl = toHumanUrl(configService.get('PUBLIC_BASE_URL', { infer: true })).replace(/\/+$/, '');
  }

  /**
   * Показывает меню владельца — **объединённое**: разбор заявок плюс то, что доступно гостю.
   * @param chatId Чат владельца.
   * @returns Промис завершения.
   */
  public async sendMenu(chatId: string): Promise<void> {
    const waiting = await this._repository.countRequestsByStatus('pending');
    const linked = await this._repository.findLinkByChat(chatId);
    const menu: TelegramButton[][] = [
      [{ text: `📋 Заявки (${String(waiting)})`, callbackData: 'q:0' }],
      [{ text: '📜 История решений', callbackData: 'h:0' }],
      [{ text: '🎟 Вступить в «Нормисы»', callbackData: 'join' }],
      [{ text: '➕ Получить приглашения', callbackData: 'invites' }],
    ];
    const account =
      linked === null ? null : await this._accountDomainService.getActiveById(linked.accountId).catch(() => null);
    const hint =
      account === null
        ? '\n\n⚠️ Аккаунт не привязан — выдать код я не смогу. Возьми код в личном кабинете («Настройки → Telegram») и пришли мне: <code>/link КОД</code>'
        : `\n\nПриглашения выдаются от аккаунта <b>@${escapeHtml(account.login)}</b> (осталось: ${String(account.invitesRemaining)}).`;
    await this._api.sendMessage(chatId, `<b>Меню владельца</b>${hint}`, menu);
  }

  /**
   * Показывает страницу очереди заявок или истории решений.
   * @param chatId Чат владельца.
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
   * @param chatId Чат владельца.
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
    // в этом же чате: пересылаем его сам себе, и владелец видит исходную анкету.
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
   * @param chatId Чат владельца.
   * @param kind Одобрить или отказать.
   * @param requestId Заявка.
   * @returns Промис завершения.
   */
  public async askReason(chatId: string, kind: OwnerActionKind, requestId: string): Promise<void> {
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
   * @param chatId Чат владельца.
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
   * @param chatId Чат владельца.
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
   * @param chatId Чат владельца.
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
   * @param chatId Чат владельца.
   * @param requestId Заявка.
   * @param reason Подпись к приглашению или null.
   * @returns Промис завершения.
   */
  private async _approve(chatId: string, requestId: string, reason: string | null): Promise<void> {
    const request = await this._repository.findRequestById(requestId);
    if (request === null || request.status !== 'pending') {
      await this._api.sendMessage(chatId, 'Эта заявка уже закрыта.');
      return;
    }
    const link = await this._repository.findLinkByChat(chatId);
    if (link === null) {
      await this._api.sendMessage(
        chatId,
        'Сначала привяжи аккаунт — от него будет выдан код: <code>/link мой_логин</code>',
      );
      return;
    }

    // Квота и код — в одной транзакции: списалось, но код не создался — откатываем оба.
    let created: { code: string; id: string };
    try {
      created = await this._transactionRunner.run(async (tx) => {
        const consumed = await this._accountDomainService.consumeInviteQuota(link.accountId, tx);
        if (!consumed) {
          throw new Error('QUOTA');
        }
        const inviteCode = await this._inviteDomainService.createCode(
          link.accountId,
          reason ?? DEFAULT_REASON,
          tx,
        );
        return { code: inviteCode.code, id: inviteCode.id };
      });
    } catch (error) {
      const quotaSpent = error instanceof Error && error.message === 'QUOTA';
      await this._api.sendMessage(
        chatId,
        quotaSpent ? 'Квота приглашений исчерпана — код не выдан.' : 'Не получилось создать код.',
      );
      this._logger.warn(`Одобрение заявки ${requestId} не прошло: ${String(error)}`);
      return;
    }

    // Заявка закрывается ПОСЛЕ выдачи: если код не создался, она осталась бы pending —
    // это лучше, чем закрытая заявка без кода.
    // Ссылка на код — не украшение: по ней бот узнаёт, что человек зарегистрировался именно по
    // этой заявке, и спрашивает у него согласие на уведомления (·15). Без неё связь теряется.
    const closed = await this._repository.decideIfPending(requestId, {
      status: 'approved',
      decisionReason: reason,
      inviteCodeId: created.id,
      grantedAmount: null,
    });
    if (!closed) {
      // Кто-то закрыл её параллельно (кнопка под сообщением и очередь — два входа).
      this._logger.warn(`Заявка ${requestId} закрыта параллельно; код ${created.code} уже выдан.`);
    }

    // Ссылка ведёт на страницу «Тебя пригласили!», а не сразу на форму: человек сначала
    // видит, куда его позвали и почему, и только потом регистрируется. Код в ссылке
    // подставится сам. Адрес берётся из конфига — на стейдже он другой, и зашитый
    // «нормисы.рф» отправлял бы тестового человека на боевой сайт.
    const inviteLink = `${this._baseUrl}/invite?code=${encodeURIComponent(created.code)}`;
    await this._api.sendMessage(
      request.chatId,
      [
        '🎟 <b>Заявка одобрена</b>',
        '',
        `Твоя ссылка-приглашение: ${escapeHtml(inviteLink)}`,
        '',
        `Если ссылка не открылась — код можно ввести вручную: <code>${escapeHtml(created.code)}</code>`,
      ].join('\n'),
    );
    await this._api.sendMessage(chatId, `Код выдан и отправлен: <code>${escapeHtml(created.code)}</code>`, [
      [{ text: '📋 К заявкам', callbackData: 'q:0' }, MENU_BUTTON],
    ]);
  }

  /**
   * Начисляет приглашения по просьбе (·13).
   *
   * **Закрытие заявки идёт первым и в той же транзакции.** Обратный порядок («начислил, потом
   * закрыл») при двух нажатиях подряд начисляет дважды: второй заход застаёт заявку ещё
   * открытой. Здесь второй заход не проходит вовсе — `decideIfPending` вернёт `false`, и
   * транзакция откатится, не тронув квоту.
   * @param chatId Чат владельца.
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
    const request = await this._repository.findRequestById(requestId);
    if (request === null || request.status !== 'pending') {
      await this._api.sendMessage(chatId, 'Эта заявка уже закрыта.');
      return;
    }
    const accountId = request.accountId;
    if (accountId === null) {
      // Схема такого не допускает (`check` на пару «тип ↔ аккаунт»), но начисление «никому» —
      // ровно тот случай, где молчаливое падение дороже проверки.
      await this._api.sendMessage(chatId, 'У заявки нет аккаунта — начислять некому.');
      return;
    }

    let remaining: number;
    try {
      remaining = await this._transactionRunner.run(async (tx) => {
        const closed = await this._repository.decideIfPending(
          requestId,
          {
            status: 'approved',
            decisionReason: reason,
            inviteCodeId: null,
            grantedAmount: amount,
          },
          tx,
        );
        if (!closed) {
          throw new Error('CLOSED');
        }
        const updated = await this._accountDomainService.grantInviteQuota(accountId, amount, tx);
        if (updated === null) {
          throw new Error('NO_ACCOUNT');
        }
        return updated;
      });
    } catch (error) {
      const closed = error instanceof Error && error.message === 'CLOSED';
      await this._api.sendMessage(
        chatId,
        closed ? 'Эта заявка уже закрыта.' : 'Не получилось начислить — аккаунт недоступен.',
      );
      this._logger.warn(`Начисление по заявке ${requestId} не прошло: ${String(error)}`);
      return;
    }

    await this._api.sendMessage(
      request.chatId,
      [
        `➕ <b>Начислено приглашений: +${String(amount)}</b>`,
        '',
        `Теперь у тебя их ${String(remaining)}. Выдать приглашение можно в личном кабинете.`,
        ...(reason === null ? [] : ['', `От владельца: ${escapeHtml(reason)}`]),
      ].join('\n'),
    );
    await this._api.sendMessage(chatId, `Начислено +${String(amount)}.`, [
      [{ text: '📋 К заявкам', callbackData: 'q:0' }, MENU_BUTTON],
    ]);
  }

  /**
   * Отказывает по заявке.
   * @param chatId Чат владельца.
   * @param requestId Заявка.
   * @param reason Причина или null.
   * @returns Промис завершения.
   */
  private async _reject(chatId: string, requestId: string, reason: string | null): Promise<void> {
    const request = await this._repository.findRequestById(requestId);
    if (request === null) {
      await this._api.sendMessage(chatId, 'Заявка не найдена.');
      return;
    }
    const closed = await this._repository.decideIfPending(requestId, {
      status: 'rejected',
      decisionReason: reason,
      inviteCodeId: null,
      grantedAmount: null,
    });
    if (!closed) {
      await this._api.sendMessage(chatId, 'Эта заявка уже закрыта.');
      return;
    }
    await this._api.sendMessage(
      request.chatId,
      reason === null
        ? 'К сожалению, заявка отклонена.'
        : `К сожалению, заявка отклонена.\n\nПричина: ${escapeHtml(reason)}`,
    );
    await this._api.sendMessage(chatId, 'Отказ отправлен.', [
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
