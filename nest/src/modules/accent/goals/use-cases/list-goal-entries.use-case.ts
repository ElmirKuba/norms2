import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalEntryView } from '../interfaces/goal-entry-view.interface';
import type { GoalEntryView } from '../interfaces/goal-entry-view.interface';

/** Размер страницы истории записей по умолчанию. */
const DEFAULT_LIMIT = 50;
/** Максимальный размер страницы. */
const MAX_LIMIT = 200;

/**
 * Use-case истории записей цели (`GET /accent/goals/:id/entries?cursor&limit`). Тонкий:
 * domain проверяет владение и отдаёт страницу (новые сверху).
 */
@Injectable()
export class ListGoalEntriesUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param cursor Курсор (id последней полученной) или undefined.
   * @param limit Размер страницы (зажат в [1, 200], дефолт 50).
   * @returns Страница записей.
   */
  public async execute(
    goalId: string,
    accountId: string,
    cursor: string | undefined,
    limit?: number,
  ): Promise<GoalEntryView[]> {
    const safeLimit = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const items = await this._goals.listEntries(goalId, accountId, cursor, safeLimit);
    return items.map((item) => toGoalEntryView(item));
  }
}
