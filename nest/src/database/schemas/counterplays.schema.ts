import { index, integer, text } from 'drizzle-orm/pg-core';
import { obstacles } from './obstacles.schema';
import { microWins } from './micro-wins.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { CounterplayFull } from '../../modules/accent/obstacles/interfaces/counterplay-full.interface';

/**
 * counterplays — контрмеры, свои заранее заготовленные ответы на препятствие (колонки 1:1 с
 * CounterplayFull, domain-model §8, ADR-0062). `obstacle_id` → `obstacles` ON DELETE CASCADE
 * (удалили препятствие — ответы к нему теряют смысл). `linked_micro_win_id` → `micro_wins`
 * ON DELETE **SET NULL**: удалённая микро-победа не должна уносить с собой формулировку ответа —
 * контрмера просто перестаёт быть запускаемой. Порядок ручной (ADR-0054); авто-сортировки по
 * действенности нет — список не должен прыгать под руками (ADR-0062 п.7).
 */
export const counterplays = defineTableWithSchema<CounterplayFull>()(
  'counterplays',
  {
    id: idColumn(),
    obstacleId: fkColumn('obstacle_id')
      .notNull()
      .references(() => obstacles.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    linkedMicroWinId: fkColumn('linked_micro_win_id').references(() => microWins.id, {
      onDelete: 'set null',
    }),
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (table) => [index('counterplays_obstacle_position_idx').on(table.obstacleId, table.position)],
);
