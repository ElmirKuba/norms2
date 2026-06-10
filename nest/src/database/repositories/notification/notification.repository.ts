import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { notifications } from '../../schemas/notifications.schema';
import { notificationReads } from '../../schemas/notification-reads.schema';
import type { NotificationRepositoryPort, NotificationReadInsert } from '../../../modules/notifications/adapters/notification-repository.port';
import type { NotificationBase } from '../../../modules/notifications/interfaces/notification-base.interface';
import type { NotificationFull } from '../../../modules/notifications/interfaces/notification-full.interface';
import type { NotificationView } from '../../../modules/notifications/interfaces/notification-view.interface';

/** Лимит выдачи списка (центр показывает последние). */
const LIST_LIMIT = 50;

/**
 * Drizzle-реализация порта уведомлений. «Мои» — broadcast (`account_id IS NULL`)
 * или персональные мне; `read` — LEFT JOIN notification_reads по моему accountId.
 */
@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
  /**
   * @param _db Инстанс Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Создаёт уведомление.
   * @param id Идентификатор.
   * @param data Данные.
   * @returns Созданная строка.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async create(id: string, data: NotificationBase): Promise<NotificationFull> {
    const rows = await this._db.insert(notifications).values({ id, ...data }).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT notifications не вернул строку.');
    }
    return row;
  }

  /**
   * Мои уведомления (broadcast + персональные), новые сверху, с флагом read.
   * @param accountId Смотрящий.
   * @returns Проекции.
   */
  public async listForAccount(accountId: string): Promise<NotificationView[]> {
    return this._db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        contentFile: notifications.contentFile,
        createdAt: notifications.createdAt,
        read: sql<boolean>`${notificationReads.id} is not null`,
      })
      .from(notifications)
      .leftJoin(
        notificationReads,
        and(
          eq(notificationReads.notificationId, notifications.id),
          eq(notificationReads.accountId, accountId),
        ),
      )
      .where(or(isNull(notifications.accountId), eq(notifications.accountId, accountId)))
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT);
  }

  /**
   * Число непрочитанных моих уведомлений.
   * @param accountId Смотрящий.
   * @returns Количество.
   */
  public async countUnread(accountId: string): Promise<number> {
    const rows = await this._db
      .select({ value: count() })
      .from(notifications)
      .leftJoin(
        notificationReads,
        and(
          eq(notificationReads.notificationId, notifications.id),
          eq(notificationReads.accountId, accountId),
        ),
      )
      .where(
        and(
          or(isNull(notifications.accountId), eq(notifications.accountId, accountId)),
          isNull(notificationReads.id),
        ),
      );
    return rows[0]?.value ?? 0;
  }

  /**
   * Уведомление по id.
   * @param id Идентификатор.
   * @returns Строка или null.
   */
  public async findById(id: string): Promise<NotificationFull | null> {
    const rows = await this._db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * Отмечает прочитанным (идемпотентно).
   * @param id PK отметки.
   * @param accountId Кто.
   * @param notificationId Что.
   * @returns Промис завершения.
   */
  public async insertRead(id: string, accountId: string, notificationId: string): Promise<void> {
    await this._db
      .insert(notificationReads)
      .values({ id, accountId, notificationId })
      .onConflictDoNothing({
        target: [notificationReads.accountId, notificationReads.notificationId],
      });
  }

  /**
   * Id моих непрочитанных уведомлений.
   * @param accountId Смотрящий.
   * @returns Идентификаторы.
   */
  public async listUnreadIds(accountId: string): Promise<string[]> {
    const rows = await this._db
      .select({ id: notifications.id })
      .from(notifications)
      .leftJoin(
        notificationReads,
        and(
          eq(notificationReads.notificationId, notifications.id),
          eq(notificationReads.accountId, accountId),
        ),
      )
      .where(
        and(
          or(isNull(notifications.accountId), eq(notifications.accountId, accountId)),
          isNull(notificationReads.id),
        ),
      );
    return rows.map((row) => row.id);
  }

  /**
   * Bulk-вставка отметок «прочитано» (идемпотентно).
   * @param rows Отметки.
   * @returns Промис завершения.
   */
  public async insertReads(rows: NotificationReadInsert[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this._db
      .insert(notificationReads)
      .values(rows)
      .onConflictDoNothing({
        target: [notificationReads.accountId, notificationReads.notificationId],
      });
  }
}
