import { z } from 'zod';

/** Календарная дата YYYY-MM-DD. */
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'occurredOn — дата формата YYYY-MM-DD.');

/**
 * Схема тела PATCH /accent/goals/:id/entries/:entryId (патч 8, ручная коррекция; все поля
 * опциональны). Семантику value (≠0 для accumulate) проверяет домен.
 */
export const updateGoalEntrySchema = z
  .object({
    value: z.number().finite('Значение — число.').optional(),
    occurredOn: ymd.optional(),
    note: z.string().max(2000).nullish(),
  })
  .strict();

/** Тип тела правки записи прогресса. */
export type UpdateGoalEntryDto = z.infer<typeof updateGoalEntrySchema>;
