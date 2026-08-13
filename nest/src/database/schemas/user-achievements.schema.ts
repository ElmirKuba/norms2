import { timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  AchievementCode,
  UserAchievementFull,
} from '../../modules/accent/progress/interfaces/user-achievement-full.interface';

/**
 * user_achievements — факты выдачи достижений (иммутабельны: только `awarded_at`, отзыва нет).
 *
 * **Единственная таблица геймификации (2.9).** Очков нет → журнал `point_events` не нужен;
 * постоянство («37 дней с действием», «5 из 7») считается проекцией из `tasks`/`micro_win_logs`/
 * `goal_entries`. Достижение так нельзя: «вернулся после десяти дней» зависит от момента.
 *
 * **`uniqueIndex (account_id, code)` — это и есть правило «один раз за всё время».** Оно живёт
 * в БД, а не в проверке кода: гонка двух параллельных запросов иначе выдала бы дубль.
 *
 * CHECK на `code` сознательно нет: каталог живёт в коде и вырастет в части 2 (очки/уровни) —
 * CHECK превратил бы каждое новое достижение в миграцию.
 */
export const userAchievements = defineTableWithSchema<UserAchievementFull>()(
  'user_achievements',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id),
    code: varchar('code', { length: 32 }).$type<AchievementCode>().notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    context: varchar('context', { length: 120 }),
  },
  (table) => [uniqueIndex('user_achievements_account_code_unique').on(table.accountId, table.code)],
);
