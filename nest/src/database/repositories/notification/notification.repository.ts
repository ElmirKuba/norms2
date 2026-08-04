import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { notifications } from '../../schemas/notifications.schema';
import { notificationReads } from '../../schemas/notification-reads.schema';
import type { NotificationRepositoryPort, NotificationReadInsert } from '../../../modules/notifications/adapters/notification-repository.port';
import type { NotificationBase } from '../../../modules/notifications/interfaces/notification-base.interface';
import type { NotificationFull } from '../../../modules/notifications/interfaces/notification-full.interface';
import type { NotificationView } from '../../../modules/notifications/interfaces/notification-view.interface';
import type { ReleaseView } from '../../../modules/notifications/interfaces/release-view.interface';

/** Лимит выдачи списка (центр показывает последние). */
const LIST_LIMIT = 50;

/** Лимит публичной витрины релизов: релизов за всю жизнь проекта меньше сотни. */
const RELEASES_LIMIT = 100;

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
        publishedAt: notifications.publishedAt,
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
      // По дате ВЫПУСКА, а не записи строки: пересев одной ноты не должен выкидывать её
      // наверх колокольчика у всех (2.9.1·15). `id` вторым — детерминированный тайбрейк:
      // в uuidv7___unixmillis время зашито в сам ключ.
      .orderBy(sql`coalesce(${notifications.publishedAt}, ${notifications.createdAt}) desc`, desc(notifications.id))
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

  /**
   * Идемпотентный сид по `key` (ON CONFLICT DO NOTHING по unique `key`).
   * @param id PK (используется только при вставке).
   * @param data Данные (с непустым `key`).
   * @returns Промис завершения.
   */
  public async createIfAbsentByKey(id: string, data: NotificationBase): Promise<boolean> {
    // `returning` отдаёт строку только при реальной вставке — по этому и различаем «создали
    // сейчас» и «уже была». Без различения сид объявлял бы в канал всю историю разом.
    const rows = await this._db
      .insert(notifications)
      .values({ id, ...data })
      .onConflictDoNothing({ target: notifications.key })
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  /**
   * Помечает ноту объявленной во внешний канал.
   * @param id Идентификатор ноты.
   * @returns Промис завершения.
   */
  public async markBroadcasted(id: string): Promise<void> {
    await this._db
      .update(notifications)
      .set({ broadcastedAt: new Date() })
      .where(eq(notifications.id, id));
  }

  /**
   * Проставляет дату выпуска, если её ещё нет (досев уже засеянных баз).
   * @param key Ключ ноты.
   * @param publishedAt Дата выпуска.
   * @returns Промис завершения.
   */
  public async setPublishedAtIfAbsent(key: string, publishedAt: Date): Promise<void> {
    await this._db
      .update(notifications)
      .set({ publishedAt })
      .where(and(eq(notifications.key, key), isNull(notifications.publishedAt)));
  }

  /**
   * Релизные ноты для публичной витрины, новые сверху.
   * `notification_reads` не джойнится вовсе — витрина открыта без авторизации,
   * прочтения остаются приватной механикой ЛК (ADR-0064 §5).
   *
   * `key` в схеме nullable (у персональных уведомлений его нет), поэтому в выборку
   * берутся только ноты с ключом: без этого условия каст `sql<string>` обещал бы
   * строку, а отдавал `null` — и витрина построила бы ссылку `/releases/null`.
   * @returns Проекции витрины.
   */
  public async listReleases(): Promise<ReleaseView[]> {
    return this._db
      .select({
        key: sql<string>`${notifications.key}`,
        title: notifications.title,
        body: notifications.body,
        contentFile: notifications.contentFile,
        createdAt: notifications.createdAt,
        publishedAt: notifications.publishedAt,
      })
      .from(notifications)
      .where(and(eq(notifications.kind, 'release'), isNotNull(notifications.key)))
      .orderBy(sql`coalesce(${notifications.publishedAt}, ${notifications.createdAt}) desc`, desc(notifications.id))
      .limit(RELEASES_LIMIT);
  }

  /**
   * Одна релизная нота по публичному ключу.
   * @param key Ключ (`release-2.9.0`).
   * @returns Проекция или null.
   */
  public async findReleaseByKey(key: string): Promise<ReleaseView | null> {
    const rows = await this._db
      .select({
        key: sql<string>`${notifications.key}`,
        title: notifications.title,
        body: notifications.body,
        contentFile: notifications.contentFile,
        createdAt: notifications.createdAt,
        publishedAt: notifications.publishedAt,
      })
      .from(notifications)
      .where(and(eq(notifications.kind, 'release'), eq(notifications.key, key)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Релизные ноты без отметки о вещании, старые → новые.
   * @returns Ноты в хронологическом порядке.
   */
  public async listUnbroadcastedReleases(): Promise<NotificationFull[]> {
    return this._db
      .select()
      .from(notifications)
      .where(and(eq(notifications.kind, 'release'), isNull(notifications.broadcastedAt)))
      .orderBy(asc(notifications.createdAt));
  }
}
