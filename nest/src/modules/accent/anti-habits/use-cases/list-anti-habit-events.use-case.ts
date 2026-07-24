import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitEventView } from '../interfaces/anti-habit-event-view.interface';
import type { AntiHabitEventPage } from '../interfaces/anti-habit-event-view.interface';
import { decodeEventCursor, encodeEventCursor } from './event-cursor.util';

/** Размер страницы истории событий по умолчанию. */
const DEFAULT_LIMIT = 30;
/** Максимальный размер страницы. */
const MAX_LIMIT = 100;

/**
 * Use-case истории событий (`GET /accent/anti-habits/:id/events?cursor&limit`, ADR-0059).
 * Тонкий: domain проверяет владение и отдаёт страницу (новые→старые). Тянем `limit+1` для
 * признака следующей страницы; лишний элемент отсекаем и кодируем `nextCursor`.
 */
@Injectable()
export class ListAntiHabitEventsUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param cursor Непрозрачный курсор предыдущей страницы или undefined.
   * @param limit Размер страницы (зажат в [1, 100], дефолт 30).
   * @returns Страница событий + `nextCursor`.
   */
  public async execute(
    id: string,
    accountId: string,
    cursor: string | undefined,
    limit?: number,
  ): Promise<AntiHabitEventPage> {
    const safeLimit = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const rows = await this._antiHabits.listEvents(id, accountId, {
      limit: safeLimit + 1,
      cursor: decodeEventCursor(cursor),
    });

    const hasMore = rows.length > safeLimit;
    const page = hasMore ? rows.slice(0, safeLimit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeEventCursor({ occurredAt: last.occurredAt, id: last.id }) : null;

    return {
      items: page.map((row) => toAntiHabitEventView(row)),
      nextCursor,
    };
  }
}
