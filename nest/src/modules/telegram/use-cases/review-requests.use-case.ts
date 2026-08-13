import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../../invites/domain-services/invite.domain-service';
import { AuditDomainService, AUDIT_ACTIONS } from '../../audit/domain-services/audit.domain-service';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import { TRANSACTION_RUNNER } from '../../../shared/transactions/transaction-runner.port';
import { escapeHtml } from '../domain-services/telegram.domain-service';
import { RequestDecisionError } from '../../../shared/errors/request-decision.error';
import { toHumanUrl } from '../../../shared/utility-level/human-url.util';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';
import type { TransactionRunnerPort } from '../../../shared/transactions/transaction-runner.port';
import type { TelegramRequestFull } from '../interfaces/telegram-request-full.interface';
import type { TelegramRequestStatus } from '../interfaces/telegram-request-pure.interface';
import type { RequestActor } from '../interfaces/request-actor.interface';
import type { RequestDecisionOutcome } from '../interfaces/request-decision-outcome.interface';
import type { TelegramRequestReviewView } from '../interfaces/telegram-request-review-view.interface';
import type { Env } from '../../../system/config/env.schema';

/** Подпись к приглашению, если решающий поставил прочерк. */
const DEFAULT_REASON = 'По заявке через бота';

/** Разрешённые номиналы начисления — те же три, что и у кнопок бота (реш. Elmir 04.08.2026). */
export const GRANT_AMOUNTS: readonly number[] = [1, 3, 5];

/**
 * Разбор заявок из Telegram — **единственное место, где заявка закрывается** (2.9.3·11).
 *
 * **Почему один класс на два входа.** Решать заявки можно из бота (кнопки под карточкой) и из
 * админки (`/admin/telegram/requests`). Скопировать логику во второй вход означало бы завести
 * два пути, которые расходятся молча: в одном учли квоту, в другом забыли; в одном закрыли
 * заявку до начисления, в другом после — и двойное нажатие удваивает выдачу. Поэтому бот и
 * админка зовут **этот** use-case, а сами занимаются только своим представлением.
 *
 * **Актёр — аккаунт, а не чат.** Раньше решение было завязано на `chatId`: от него брался
 * аккаунт-выдаватель. У админки чата нет вовсе, поэтому ядро принимает `RequestActor`
 * (аккаунт + логин), а бот резолвит `chatId → привязка → аккаунт` до вызова.
 *
 * **`notified: false` — штатный исход, а не ошибка.** Бот бывает на паузе (2.9.3·4) или человек
 * его заблокировал; решение при этом записано, а заявитель о нём не знает. Молчать об этом
 * нельзя: решающий уверен, что ответ ушёл. Поэтому флаг едет в ответе обоим входам.
 *
 * **Проверка прав здесь не делается** — она выше: у бота по роли привязанного аккаунта (·3а), у
 * админки `AuthGuard` + `RolesGuard`. Дублировать её тут значило бы создать впечатление, будто
 * она бывает необязательной.
 */
@Injectable()
export class ReviewRequestsUseCase {
  private readonly _logger = new Logger('TelegramReview');
  private readonly _baseUrl: string;

  /**
   * @param _repository Порт репозитория заявок.
   * @param _api Исходящий порт Bot API.
   * @param _accountDomainService Domain-service аккаунтов (квота приглашений).
   * @param _inviteDomainService Domain-service приглашений (создание кода).
   * @param _audit Журнал действий администратора.
   * @param _transactionRunner Раннер транзакций.
   * @param configService Конфиг (публичный адрес для ссылки-приглашения).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _accountDomainService: AccountDomainService,
    private readonly _inviteDomainService: InviteDomainService,
    private readonly _audit: AuditDomainService,
    @Inject(TRANSACTION_RUNNER) private readonly _transactionRunner: TransactionRunnerPort,
    configService: ConfigService<Env, true>,
  ) {
    this._baseUrl = toHumanUrl(configService.get('PUBLIC_BASE_URL', { infer: true })).replace(
      /\/+$/,
      '',
    );
  }

  /**
   * Страница заявок одного статуса, новые сверху.
   * @param status Какие показывать.
   * @param limit Сколько.
   * @param offset Сдвиг.
   * @returns Строки для экрана и общее число заявок в статусе.
   */
  public async list(
    status: TelegramRequestStatus,
    limit: number,
    offset: number,
  ): Promise<{ items: TelegramRequestReviewView[]; total: number }> {
    const [rows, total] = await Promise.all([
      this._repository.listRequestsByStatus(status, limit, offset),
      this._repository.countRequestsByStatus(status),
    ]);
    const items = await Promise.all(rows.map(async (row) => this._toView(row)));
    return { items, total };
  }

  /**
   * Одобряет заявку на вступление: списывает квоту решающего, создаёт код, шлёт его человеку.
   * @param requestId Заявка.
   * @param actor Кто решает (его квота и его подпись в журнале).
   * @param reason Подпись к приглашению или null.
   * @returns Итог решения.
   */
  public async approve(
    requestId: string,
    actor: RequestActor,
    reason: string | null,
  ): Promise<RequestDecisionOutcome> {
    const request = await this._requirePending(requestId);

    // Квота и код — в одной транзакции: списалось, но код не создался — откатываем оба.
    let created: { code: string; id: string };
    try {
      created = await this._transactionRunner.run(async (tx) => {
        const consumed = await this._accountDomainService.consumeInviteQuota(actor.accountId, tx);
        if (!consumed) {
          throw new RequestDecisionError('QUOTA_EXHAUSTED', 'Квота приглашений исчерпана.');
        }
        const inviteCode = await this._inviteDomainService.createCode(
          actor.accountId,
          reason ?? DEFAULT_REASON,
          tx,
        );
        return { code: inviteCode.code, id: inviteCode.id };
      });
    } catch (error) {
      if (error instanceof RequestDecisionError) {
        throw error;
      }
      this._logger.warn(`Одобрение заявки ${requestId} не прошло: ${String(error)}`);
      throw new RequestDecisionError('CREATE_FAILED', 'Не получилось создать код.');
    }

    // Заявка закрывается ПОСЛЕ выдачи: если код не создался, она осталась бы pending — это
    // лучше, чем закрытая заявка без кода. Ссылка на код нужна и потом: по ней бот узнаёт, что
    // человек зарегистрировался именно по этой заявке, и спрашивает согласие на уведомления.
    const closed = await this._repository.decideIfPending(requestId, {
      status: 'approved',
      decisionReason: reason,
      inviteCodeId: created.id,
      grantedAmount: null,
    });
    if (!closed) {
      // Кто-то закрыл её параллельно (кнопка в боте и экран админки — два входа).
      this._logger.warn(`Заявка ${requestId} закрыта параллельно; код ${created.code} уже выдан.`);
    }

    // Ссылка ведёт на страницу «Тебя пригласили!», а не сразу на форму: человек сначала видит,
    // куда его позвали и почему. Адрес — из конфига: зашитый «нормисы.рф» отправлял бы
    // тестового человека на боевой сайт.
    const inviteLink = `${this._baseUrl}/invite?code=${encodeURIComponent(created.code)}`;
    const notified = await this._notify(
      request.chatId,
      [
        '🎟 <b>Заявка одобрена</b>',
        '',
        `Твоя ссылка-приглашение: ${escapeHtml(inviteLink)}`,
        '',
        `Если ссылка не открылась — код можно ввести вручную: <code>${escapeHtml(created.code)}</code>`,
      ].join('\n'),
    );

    return this._finish(requestId, actor, AUDIT_ACTIONS.TELEGRAM_REQUEST_APPROVED, notified, {
      reason,
      code: created.code,
    }, created.code);
  }

  /**
   * Начисляет приглашения по просьбе.
   *
   * **Закрытие заявки идёт первым и в той же транзакции.** Обратный порядок («начислил, потом
   * закрыл») при двух нажатиях подряд начисляет дважды: второй заход застаёт заявку ещё
   * открытой. Здесь второй заход не проходит вовсе — `decideIfPending` вернёт `false`, и
   * транзакция откатится, не тронув квоту.
   * @param requestId Заявка.
   * @param actor Кто решает.
   * @param amount Сколько начислить.
   * @param reason Подпись к начислению или null.
   * @returns Итог решения.
   */
  public async grant(
    requestId: string,
    actor: RequestActor,
    amount: number,
    reason: string | null,
  ): Promise<RequestDecisionOutcome> {
    const request = await this._requirePending(requestId);
    if (request.type !== 'more_invites') {
      throw new RequestDecisionError('WRONG_TYPE', 'Это заявка на вступление — по ней выдаётся код.');
    }
    const accountId = request.accountId;
    if (accountId === null) {
      // Схема такого не допускает (`check` на пару «тип ↔ аккаунт»), но начисление «никому» —
      // ровно тот случай, где молчаливое падение дороже проверки.
      throw new RequestDecisionError('NO_ACCOUNT', 'У заявки нет аккаунта — начислять некому.');
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
          throw new RequestDecisionError('ALREADY_CLOSED', 'Заявка уже закрыта.');
        }
        const updated = await this._accountDomainService.grantInviteQuota(accountId, amount, tx);
        if (updated === null) {
          throw new RequestDecisionError('NO_ACCOUNT', 'Аккаунт недоступен.');
        }
        return updated;
      });
    } catch (error) {
      if (error instanceof RequestDecisionError) {
        throw error;
      }
      this._logger.warn(`Начисление по заявке ${requestId} не прошло: ${String(error)}`);
      throw new RequestDecisionError('CREATE_FAILED', 'Не получилось начислить.');
    }

    const notified = await this._notify(
      request.chatId,
      [
        `➕ <b>Начислено приглашений: +${String(amount)}</b>`,
        '',
        `Теперь у тебя их ${String(remaining)}. Выдать приглашение можно в личном кабинете.`,
        ...(reason === null ? [] : ['', `От владельца: ${escapeHtml(reason)}`]),
      ].join('\n'),
    );

    return this._finish(requestId, actor, AUDIT_ACTIONS.TELEGRAM_REQUEST_GRANTED, notified, {
      reason,
      amount,
    }, null);
  }

  /**
   * Отказывает по заявке.
   * @param requestId Заявка.
   * @param actor Кто решает.
   * @param reason Причина или null.
   * @returns Итог решения.
   */
  public async reject(
    requestId: string,
    actor: RequestActor,
    reason: string | null,
  ): Promise<RequestDecisionOutcome> {
    const request = await this._requirePending(requestId);
    const closed = await this._repository.decideIfPending(requestId, {
      status: 'rejected',
      decisionReason: reason,
      inviteCodeId: null,
      grantedAmount: null,
    });
    if (!closed) {
      throw new RequestDecisionError('ALREADY_CLOSED', 'Заявка уже закрыта.');
    }

    const notified = await this._notify(
      request.chatId,
      reason === null
        ? 'К сожалению, заявка отклонена.'
        : `К сожалению, заявка отклонена.\n\nПричина: ${escapeHtml(reason)}`,
    );

    return this._finish(requestId, actor, AUDIT_ACTIONS.TELEGRAM_REQUEST_REJECTED, notified, {
      reason,
    }, null);
  }

  /**
   * Достаёт заявку и убеждается, что она ещё ждёт решения.
   * @param requestId Заявка.
   * @returns Строка заявки.
   */
  private async _requirePending(requestId: string): Promise<TelegramRequestFull> {
    const request = await this._repository.findRequestById(requestId);
    if (request === null) {
      throw new RequestDecisionError('NOT_FOUND', 'Заявка не найдена.');
    }
    if (request.status !== 'pending') {
      throw new RequestDecisionError('ALREADY_CLOSED', 'Заявка уже закрыта.');
    }
    return request;
  }

  /**
   * Пишет в журнал и собирает итог: заявку перечитываем, чтобы отдать её уже закрытой.
   * @param requestId Заявка.
   * @param actor Кто решил.
   * @param action Код действия для журнала.
   * @param notified Дошёл ли ответ до заявителя.
   * @param details Подробности для журнала.
   * @param inviteCode Выданный код или null.
   * @returns Итог решения.
   */
  private async _finish(
    requestId: string,
    actor: RequestActor,
    action: string,
    notified: boolean,
    details: Record<string, unknown>,
    inviteCode: string | null,
  ): Promise<RequestDecisionOutcome> {
    const fresh = await this._repository.findRequestById(requestId);
    if (fresh === null) {
      throw new RequestDecisionError('NOT_FOUND', 'Заявка исчезла между решением и чтением.');
    }
    // Решение через бота — такое же администраторское действие, как через панель, и в журнал
    // попадает наравне: иначе половина решений оказалась бы вне следа.
    await this._audit.record({
      actorAccountId: actor.accountId,
      actorLogin: actor.login,
      action,
      targetType: 'telegram_request',
      targetId: requestId,
      targetLabel: fresh.type,
      details: { ...details, notified },
    });
    return { request: await this._toView(fresh), notified, inviteCode };
  }

  /**
   * Пробует сообщить заявителю. Провал — не ошибка операции, а состояние экрана.
   * @param chatId Чат заявителя.
   * @param text Текст.
   * @returns `true`, если сообщение ушло.
   */
  private async _notify(chatId: string, text: string): Promise<boolean> {
    const messageId = await this._api.sendMessage(chatId, text);
    if (messageId === null) {
      this._logger.warn(`Ответ по заявке не доставлен в чат ${chatId} — бот молчит или заблокирован.`);
    }
    return messageId !== null;
  }

  /**
   * Собирает строку для экрана: заявка плюс логин её аккаунта, если он есть.
   * @param request Строка заявки.
   * @returns Проекция для админки и бота.
   */
  private async _toView(request: TelegramRequestFull): Promise<TelegramRequestReviewView> {
    const accountLogin =
      request.accountId === null
        ? null
        : await this._accountDomainService
            .getActiveById(request.accountId)
            .then((account) => account.login)
            .catch(() => null);
    return {
      id: request.id,
      chatId: request.chatId,
      type: request.type,
      status: request.status,
      accountId: request.accountId,
      accountLogin,
      inviteCodeId: request.inviteCodeId,
      grantedAmount: request.grantedAmount,
      decisionReason: request.decisionReason,
      decidedAt: request.decidedAt,
      createdAt: request.createdAt,
    };
  }
}
