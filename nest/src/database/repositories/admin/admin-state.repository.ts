import { Inject, Injectable, Logger } from '@nestjs/common';
import { count, desc, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { accounts } from '../../schemas/accounts.schema';
import { notifications } from '../../schemas/notifications.schema';
import { releases } from '../../schemas/releases.schema';
import type { AdminStateRepositoryPort } from '../../../modules/admin/adapters/admin-state-repository.port';
import type {
  LastReleaseState,
  ProductCounters,
} from '../../../modules/admin/interfaces/release-state-view.interface';

/**
 * Drizzle-реализация порта состояния продукта (2.9.3·12).
 *
 * **Служебная таблица drizzle читается сырым SQL.** Схемы для неё нет и заводить её нельзя:
 * это внутренняя таблица мигратора, и объявить её нашей значило бы разрешить себе в неё писать.
 * Читаем через `sql`, а если её ещё нет (первый запуск до миграций) — отдаём 0 вместо падения:
 * диагностическая ручка не должна ломаться ровно в том состоянии, ради которого её открывают.
 */
@Injectable()
export class AdminStateRepository implements AdminStateRepositoryPort {
  private readonly _logger = new Logger(AdminStateRepository.name);

  /**
   * @param _database Клиент Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _database: DrizzleDatabase) {}

  /**
   * Счётчики продукта.
   * @returns Числа по трём таблицам.
   */
  public async counters(): Promise<ProductCounters> {
    // Аккаунты — только живые: удалённые остаются строками ради целостности дерева приглашений,
    // но «сколько нас» они не отражают.
    const [accountsRow] = await this._database
      .select({ value: count() })
      .from(accounts)
      .where(isNull(accounts.deletedAt));
    const [releasesRow] = await this._database.select({ value: count() }).from(releases);
    const [notificationsRow] = await this._database.select({ value: count() }).from(notifications);
    return {
      accounts: accountsRow?.value ?? 0,
      releases: releasesRow?.value ?? 0,
      notifications: notificationsRow?.value ?? 0,
    };
  }

  /**
   * Сколько миграций применено к этой базе.
   * @returns Количество строк в `drizzle.__drizzle_migrations`.
   */
  public async appliedMigrations(): Promise<number> {
    try {
      // node-postgres отдаёт `QueryResult`, а строки лежат в `.rows` — не сам массив. Разница
      // молчаливая: неверная распаковка даёт `undefined` и, через `?? 0`, честное на вид «ноль
      // миграций». Поймано живьём 13.08.2026 — экран показал «база отстала» на здоровой базе.
      const result = await this._database.execute<{ value: string }>(
        sql`select count(*)::text as value from drizzle.__drizzle_migrations`,
      );
      return Number(result.rows[0]?.value ?? 0);
    } catch (error) {
      // Схемы `drizzle` ещё нет — это первый запуск до миграций, а не поломка.
      this._logger.warn(`Не удалось прочитать таблицу миграций: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Последняя публикация по дате выпуска, с откатом на дату записи.
   * @returns Публикация или null.
   */
  public async lastRelease(): Promise<LastReleaseState | null> {
    const [row] = await this._database
      .select({
        key: releases.key,
        title: releases.title,
        publishedAt: releases.publishedAt,
        broadcastedAt: releases.broadcastedAt,
      })
      .from(releases)
      // Тот же порядок, что у витрины: без отката на `created_at` публикация без даты выпуска
      // оказалась бы «последней» или «первой» в зависимости от настроения планировщика.
      .orderBy(desc(sql`coalesce(${releases.publishedAt}, ${releases.createdAt})`))
      .limit(1);
    return row ?? null;
  }
}
