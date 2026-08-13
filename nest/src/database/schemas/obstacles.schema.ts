import { boolean, check, index, integer, text, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  ObstacleFull,
  ObstacleType,
} from '../../modules/accent/obstacles/interfaces/obstacle-full.interface';

/**
 * obstacles — препятствия (per-account; колонки 1:1 с ObstacleFull, domain-model §8, ADR-0062).
 * Две оси классификации: `type` (природа проблемы, обязательна — по ней подбирает Recommender
 * 2.8) и `domain_key` (сфера жизни, опц., мягкий ключ без FK — как у целей/привычек/микро-побед).
 * Частота столкновений и действенность контрмер НЕ хранятся — вычисляются на чтение из
 * `obstacle_encounters` (ADR-0052). `intensity` — самооценка «насколько давит на сегодня», из
 * частоты не пересчитывается. CHECK 1..5 — защита-в-глубину, дружелюбная валидация в
 * domain-service (2.7·9). Индекс `(account_id, position)` — выдача в ручном порядке (ADR-0054).
 */
export const obstacles = defineTableWithSchema<ObstacleFull>()(
  'obstacles',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id),
    name: text('name').notNull(),
    type: varchar('type', { length: 20 }).$type<ObstacleType>().notNull(),
    // Мягкий ключ сферы (без FK) — вторая ось, общая со целями/привычками (ADR-0056).
    domainKey: varchar('domain_key', { length: 64 }),
    trigger: text('trigger'),
    symptoms: text('symptoms'),
    intensity: integer('intensity').notNull().default(3),
    isActive: boolean('is_active').notNull().default(true),
    // Стартовый пример (ADR-0051 «инертная витрина»): виден с бейджем, но столкновения на нём
    // не пишутся и контрмеры не правятся до присвоения («Добавить себе»).
    isStarter: boolean('is_starter').notNull().default(false),
    // Ручной порядок (ADR-0054): per-account; новый — в конец (max+1).
    position: integer('position').notNull().default(0),
    // Оптимистичный лок (ADR-0035, конвенция от 2026-07-29): любой update bump'ает.
    version: integer('version').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    check('obstacles_intensity_range', sql`${table.intensity} BETWEEN 1 AND 5`),
    index('obstacles_account_position_idx').on(table.accountId, table.position),
  ],
);
