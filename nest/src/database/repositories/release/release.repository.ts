import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { releases } from '../../schemas/releases.schema';
import type { ReleaseRepositoryPort } from '../../../modules/notifications/adapters/release-repository.port';
import type { ReleaseFull } from '../../../modules/notifications/interfaces/release-full.interface';
import type { ReleasePure } from '../../../modules/notifications/interfaces/release-pure.interface';
import type { ReleaseView } from '../../../modules/notifications/interfaces/release-view.interface';

/** Лимит публичной витрины: релизов за всю жизнь проекта меньше сотни. */
const RELEASES_LIMIT = 100;

/**
 * Drizzle-реализация порта публикаций ([ADR-0065](../../../../../docs/decisions/0065-release-vs-notification-split.md)).
 *
 * `notification_reads` здесь не участвует вовсе — и это главное следствие разделения: витрина
 * физически не может тронуть отметки о прочтении, потому что таблицы просто не связаны.
 */
@Injectable()
export class ReleaseRepository implements ReleaseRepositoryPort {
  /**
   * @param _db Инстанс Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Публикации для витрины, новые сверху.
   * @returns Проекции витрины.
   */
  public async listPublic(): Promise<ReleaseView[]> {
    return this._db
      .select({
        key: releases.key,
        title: releases.title,
        // `body` в публикации нет: короткий inline-текст — свойство доставки, не выпуска.
        // Поле остаётся в контракте витрины ради совместимости и всегда null.
        body: sql<string | null>`null::text`,
        contentFile: releases.contentFile,
        contentFormat: releases.contentFormat,
        createdAt: releases.createdAt,
        publishedAt: releases.publishedAt,
      })
      .from(releases)
      // По дате ВЫПУСКА с откатом на дату записи; `id` вторым — детерминированный тайбрейк
      // (в uuidv7___unixmillis время зашито в сам ключ).
      .orderBy(sql`coalesce(${releases.publishedAt}, ${releases.createdAt}) desc`, sql`${releases.id} desc`)
      .limit(RELEASES_LIMIT);
  }

  /**
   * Одна публикация по ключу.
   * @param key Ключ.
   * @returns Проекция или null.
   */
  public async findByKey(key: string): Promise<ReleaseView | null> {
    const rows = await this._db
      .select({
        key: releases.key,
        title: releases.title,
        body: sql<string | null>`null::text`,
        contentFile: releases.contentFile,
        contentFormat: releases.contentFormat,
        createdAt: releases.createdAt,
        publishedAt: releases.publishedAt,
      })
      .from(releases)
      .where(eq(releases.key, key))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт публикацию, если ключа ещё нет.
   * @param id Идентификатор (только при вставке).
   * @param data Данные публикации.
   * @returns Идентификатор строки и признак создания.
   */
  public async createIfAbsentByKey(
    id: string,
    data: ReleasePure,
  ): Promise<{ id: string; created: boolean }> {
    const inserted = await this._db
      .insert(releases)
      .values({ id, ...data })
      .onConflictDoNothing({ target: releases.key })
      .returning({ id: releases.id });
    const created = inserted[0];
    if (created) {
      return { id: created.id, created: true };
    }
    // Ключ уже был: возвращаем идентификатор существующей публикации — сидеру он нужен,
    // чтобы связать с ней доставку.
    const existing = await this._db
      .select({ id: releases.id })
      .from(releases)
      .where(eq(releases.key, data.key))
      .limit(1);
    const row = existing[0];
    if (!row) {
      throw new Error(`Публикация '${data.key}' не вставилась и не найдена.`);
    }
    return { id: row.id, created: false };
  }

  /**
   * Проставляет дату выпуска, если её ещё нет.
   * @param key Ключ.
   * @param publishedAt Дата выпуска.
   * @returns Промис завершения.
   */
  public async setPublishedAtIfAbsent(key: string, publishedAt: Date): Promise<void> {
    await this._db
      .update(releases)
      .set({ publishedAt })
      .where(sql`${releases.key} = ${key} and ${releases.publishedAt} is null`);
  }

  /**
   * Помечает публикацию объявленной наружу.
   * @param id Идентификатор публикации.
   * @returns Промис завершения.
   */
  public async markBroadcasted(id: string): Promise<void> {
    await this._db.update(releases).set({ broadcastedAt: new Date() }).where(eq(releases.id, id));
  }

  /**
   * Публикации без отметки о вещании, старые → новые.
   * @returns Строки в хронологическом порядке.
   */
  public async listUnbroadcasted(): Promise<ReleaseFull[]> {
    return this._db
      .select()
      .from(releases)
      .where(isNull(releases.broadcastedAt))
      .orderBy(asc(sql`coalesce(${releases.publishedAt}, ${releases.createdAt})`), asc(releases.id));
  }

  /**
   * Удаляет публикацию по ключу (2.9.3·7).
   *
   * Возвращает удалённую строку, а не признак: вызывающему нужен заголовок для журнала, и
   * повторный `select` перед `delete` дал бы окно, в котором строка успевает исчезнуть.
   *
   * @param key Публичный ключ публикации.
   * @returns Удалённая публикация или null.
   */
  public async deleteByKey(key: string): Promise<ReleaseFull | null> {
    const [row] = await this._db.delete(releases).where(eq(releases.key, key)).returning();
    return row ?? null;
  }
}
