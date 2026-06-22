import { z } from 'zod';

/** Календарная дата YYYY-MM-DD. */
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'occurredOn — дата формата YYYY-MM-DD.');

/**
 * Схема тела POST /accent/goals/:id/entries (closed-shape). `value` — число (инкремент для
 * accumulate / замер для reach/reduce; семантику ≠0 проверяет домен). `occurredOn` опц.
 * (дефолт — сегодня в TZ пользователя).
 */
export const addGoalEntrySchema = z
  .object({
    value: z.number().finite('Значение — число.'),
    occurredOn: ymd.nullish(),
    note: z.string().max(2000).nullish(),
  })
  .strict();

/** Тип тела добавления записи прогресса. */
export type AddGoalEntryDto = z.infer<typeof addGoalEntrySchema>;
