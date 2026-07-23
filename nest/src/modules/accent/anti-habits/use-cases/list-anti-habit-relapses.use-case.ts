import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitRelapseView } from '../interfaces/anti-habit-relapse-view.interface';
import type { AntiHabitRelapsePage } from '../interfaces/anti-habit-relapse-view.interface';
import { decodeRelapseCursor, encodeRelapseCursor } from './relapse-cursor.util';

/** Размер страницы истории рецидивов по умолчанию. */
const DEFAULT_LIMIT = 30;
/** Максимальный размер страницы. */
const MAX_LIMIT = 100;

/**
 * Use-case истории рецидивов (`GET /accent/anti-habits/:id/relapses?cursor&limit`). Тонкий:
 * domain проверяет владение и отдаёт страницу (новые→старые). Запрашиваем `limit+1`, чтобы
 * определить наличие следующей страницы; лишний элемент отсекаем и кодируем `nextCursor`.
 */
@Injectable()
export class ListAntiHabitRelapsesUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param cursor Непрозрачный курсор предыдущей страницы или undefined.
   * @param limit Размер страницы (зажат в [1, 100], дефолт 30).
   * @returns Страница рецидивов + `nextCursor`.
   */
  public async execute(
    id: string,
    accountId: string,
    cursor: string | undefined,
    limit?: number,
  ): Promise<AntiHabitRelapsePage> {
    const safeLimit = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const rows = await this._antiHabits.listRelapses(id, accountId, {
      limit: safeLimit + 1,
      cursor: decodeRelapseCursor(cursor),
    });

    const hasMore = rows.length > safeLimit;
    const page = hasMore ? rows.slice(0, safeLimit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeRelapseCursor({ relapseAt: last.relapseAt, id: last.id }) : null;

    return {
      items: page.map((row) => toAntiHabitRelapseView(row)),
      nextCursor,
    };
  }
}
