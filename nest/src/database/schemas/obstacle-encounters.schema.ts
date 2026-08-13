import { bigint, index, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { obstacles } from './obstacles.schema';
import { counterplays } from './counterplays.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  EncounterOutcome,
  ObstacleEncounterFull,
} from '../../modules/accent/obstacles/interfaces/obstacle-encounter-full.interface';

/**
 * obstacle_encounters — журнал столкновений «сегодня это препятствие сработало» (колонки 1:1 с
 * ObstacleEncounterFull, domain-model §8, ADR-0062). **Append-only** → `version` не нужен
 * (ADR-0035, уточнение); единственный modify — проставить `outcome` позже.
 *
 * `obstacle_id` → CASCADE (журнал живёт вместе с препятствием), `counterplay_id` → **SET NULL**
 * (удалили контрмеру — факт столкновения остаётся, теряется лишь «чем ответил»). `outcome`
 * nullable намеренно: пустое = «не отмечено», а не «не помогло». Время — unix ms (`bigint`), как
 * в «держусь»: шлём на фронт и считаем арифметику. Индекс `(obstacle_id, occurred_at)` — keyset-
 * лента и подсчёт «мешал N раз за 30 дней» (обе величины вычисляются на чтение, ADR-0052).
 */
export const obstacleEncounters = defineTableWithSchema<ObstacleEncounterFull>()(
  'obstacle_encounters',
  {
    id: idColumn(),
    obstacleId: fkColumn('obstacle_id')
      .notNull()
      .references(() => obstacles.id),
    occurredAt: bigint('occurred_at', { mode: 'number' }).notNull(),
    counterplayId: fkColumn('counterplay_id').references(() => counterplays.id, {
      onDelete: 'set null',
    }),
    outcome: varchar('outcome', { length: 8 }).$type<EncounterOutcome>(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('obstacle_encounters_obstacle_at_idx').on(table.obstacleId, table.occurredAt),
  ],
);
