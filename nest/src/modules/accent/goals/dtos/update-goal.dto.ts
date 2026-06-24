import { z } from 'zod';

/** Календарная дата YYYY-MM-DD (для `deadline`). */
const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'deadline — дата формата YYYY-MM-DD.');

/**
 * Схема тела PATCH /accent/goals/:id (closed-shape, все поля опциональны). `direction`/
 * `startValue`/`parentGoalId` **не меняются** (иммутабельны после создания, ADR-0052) —
 * их тут нет. Смена `targetValue` валидируется доменом против неизменного рода/базы.
 */
export const updateGoalSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(160).optional(),
    whyItMatters: z.string().max(2000).nullish(),
    domainKey: z.string().max(64).nullish(),
    attributes: z.array(z.string().max(64)).max(20).optional(),
    unit: z.string().min(1).max(32).optional(),
    targetValue: z.number().finite('Целевое значение — число.').optional(),
    deadline: ymd.nullish(),
    fallbackVersion: z.string().max(280).nullish(),
    tradeoff: z.string().max(280).nullish(),
  })
  .strict();

/** Тип тела обновления цели. */
export type UpdateGoalDto = z.infer<typeof updateGoalSchema>;
