import { boolean, date, integer, jsonb, text, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  HabitFull,
  HabitKind,
  HabitLadder,
} from '../../modules/accent/habits/interfaces/habit-full.interface';

/**
 * habits — привычки (TaskTemplate; per-account; колонки 1:1 с HabitFull). `ladder` —
 * jsonb value-object (min/current/goal/step/policy + easyStreak/missStreak для
 * LadderEngine §7); `attributes` — jsonb string[] (ключи RPG-атрибутов). `recurrence`
 * — строка RRULE. `goal_id` — без FK до появления `goals` (2.5); `domain_key` — мягкий
 * ключ сферы. Задачи дня материализуются из активных привычек (2.4·8).
 */
export const habits = defineTableWithSchema<HabitFull>()(
  'habits',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 32 }),
    domainKey: varchar('domain_key', { length: 64 }),
    attributes: jsonb('attributes').$type<string[]>().notNull().default([]),
    goalId: fkColumn('goal_id'),
    priority: integer('priority').notNull().default(0),
    kind: varchar('kind', { length: 16 }).$type<HabitKind>().notNull(),
    recurrence: text('recurrence').notNull(),
    // Якорь расписания (dtstart для INTERVAL-правил «каждые N дней», BUG-2). Nullable:
    // null → фолбэк на дату создания в TZ аккаунта. Пользователь может стартовать не с
    // сегодня (напр. завтра) → две привычки «каждые 2 дня» в противофазе (чередование).
    startDate: date('start_date'),
    isActive: boolean('is_active').notNull().default(true),
    isStarter: boolean('is_starter').notNull().default(false),
    ladder: jsonb('ladder').$type<HabitLadder>().notNull(),
    minVersion: text('min_version'),
    // Время подготовки (сек) перед timed-таймером (опц., FEAT-H1); как у микро-побед.
    prepSeconds: integer('prep_seconds'),
    // Оптимистичный лок (ADR-0035): движок лесенки пишет через CAS по version,
    // любой update bump'ает version (правки целей лесенки vs движок при мультидевайсе).
    version: integer('version').notNull().default(0),
    ...timestamps(),
  },
);
