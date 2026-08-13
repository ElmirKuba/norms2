import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { ValidationError } from '../../../shared/errors/validation.error';
import {
  GRANT_AMOUNTS,
  ReviewRequestsUseCase,
} from '../../telegram/use-cases/review-requests.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { RequestDecisionOutcome } from '../../telegram/interfaces/request-decision-outcome.interface';
import type { TelegramRequestReviewView } from '../../telegram/interfaces/telegram-request-review-view.interface';
import type { TelegramRequestStatus } from '../../telegram/interfaces/telegram-request-pure.interface';

/** Допустимые статусы фильтра — белым списком, чтобы в запрос не уехала произвольная строка. */
const STATUSES: readonly TelegramRequestStatus[] = ['pending', 'approved', 'rejected', 'expired'];

/** Размер страницы по умолчанию и потолок. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Тело решения по заявке. */
interface DecisionBody {
  /** Причина/подпись или пусто — тогда null. */
  reason?: string;
  /** Сколько приглашений начислить (только `more_invites`). */
  amount?: number;
}

/**
 * Разбор заявок из Telegram в админке (`/api/v1/admin/telegram/requests`, 2.9.3·11).
 *
 * **Контроллер тонкий намеренно: логика решения живёт в `ReviewRequestsUseCase` — том самом,
 * который зовёт бот.** Контракт ·5 требует именно этого: два входа, один код. Здесь остаётся
 * только то, что относится к HTTP, — разбор параметров запроса. Коды отказа наружу отдаёт
 * глобальный фильтр: `RequestDecisionError` — это `DomainError`, и статус едет в ней самой.
 *
 * ⚠️ Наружу уходит `chatId` — идентификатор человека в чужом сервисе. Он виден **только на этом
 * экране и только админу**: без него заявку не с чем сопоставить в переписке бота. Текста заявки
 * тут нет и быть не может — он не хранится (ADR-0064 §10).
 */
@Controller('admin/telegram/requests')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminTelegramController {
  /**
   * @param _review Ядро разбора заявок, общее с ботом.
   */
  public constructor(private readonly _review: ReviewRequestsUseCase) {}

  /**
   * Страница заявок выбранного статуса, новые сверху.
   * @param status Статус (по умолчанию `pending`).
   * @param limit Размер страницы.
   * @param offset Сдвиг.
   * @returns Строки и общее число заявок в статусе.
   */
  @Get()
  public async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ items: TelegramRequestReviewView[]; total: number }> {
    return this._review.list(this._status(status), this._limit(limit), this._offset(offset));
  }

  /**
   * Одобряет заявку: у вступления — выдаёт код, у просьбы о приглашениях — начисляет номинал.
   *
   * **Номинал только из трёх разрешённых** (`+1 / +3 / +5`) — как у кнопок бота. Свободное поле
   * тут не годится по той же причине, что и там: это раздача доступа, а лишний ноль вводится в
   * спешке незаметно.
   * @param id Заявка.
   * @param body Причина и (для `more_invites`) номинал.
   * @param request Запрос (аккаунт из Guard) — с его квоты списывается приглашение.
   * @returns Итог решения вместе с флагом доставки.
   */
  @Post(':id/approve')
  public async approve(
    @Param('id') id: string,
    @Body() body: DecisionBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<RequestDecisionOutcome> {
    const actor = { accountId: request.account.id, login: request.account.login };
    const reason = this._reason(body.reason);
    if (body.amount === undefined) {
      return this._review.approve(id, actor, reason);
    }
    if (!GRANT_AMOUNTS.includes(body.amount)) {
      throw new ValidationError(
        `Начислить можно только ${GRANT_AMOUNTS.map((amount) => `+${String(amount)}`).join(', ')}.`,
      );
    }
    return this._review.grant(id, actor, body.amount, reason);
  }

  /**
   * Отказывает по заявке. Причина уходит человеку дословно.
   * @param id Заявка.
   * @param body Причина или пусто.
   * @param request Запрос (аккаунт из Guard).
   * @returns Итог решения вместе с флагом доставки.
   */
  @Post(':id/reject')
  public async reject(
    @Param('id') id: string,
    @Body() body: DecisionBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<RequestDecisionOutcome> {
    const actor = { accountId: request.account.id, login: request.account.login };
    return this._review.reject(id, actor, this._reason(body.reason));
  }

  /**
   * Приводит статус из строки запроса к допустимому.
   * @param value Что пришло.
   * @returns Статус.
   */
  private _status(value?: string): TelegramRequestStatus {
    const found = STATUSES.find((status) => status === value);
    return found ?? 'pending';
  }

  /**
   * Ограничивает размер страницы.
   * @param value Что пришло.
   * @returns Размер страницы.
   */
  private _limit(value?: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(Math.trunc(parsed), MAX_LIMIT);
  }

  /**
   * Приводит сдвиг к неотрицательному целому.
   * @param value Что пришло.
   * @returns Сдвиг.
   */
  private _offset(value?: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.trunc(parsed);
  }

  /**
   * Пустая причина — это `null`, а не пустая строка: в базе прочерк и «не указано» должны
   * выглядеть одинаково.
   * @param value Что пришло.
   * @returns Причина или null.
   */
  private _reason(value?: string): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
  }
}
