import { z } from 'zod';
import { GOAL_DIRECTIONS } from '../interfaces/goal-full.interface';

/** Календарная дата YYYY-MM-DD (для `deadline`). */
const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'deadline — дата формата YYYY-MM-DD.');

/**
 * Поля цели в теле. `direction` — род цели (accumulate/reach/reduce, ADR-0052). Числовые
 * инварианты (accumulate `target>0`; reach/reduce `target≠start`) и глубину дерева
 * проверяет domain-service. `targetValue`/`startValue` — числа (дробные ок).
 */
export const goalBodyShape = {
  title: z.string().min(1, 'Название обязательно.').max(160, 'Название: максимум 160.'),
  whyItMatters: z.string().max(2000).nullish(),
  domainKey: z.string().max(64).nullish(),
  attributes: z.array(z.string().max(64)).max(20).optional(),
  parentGoalId: z.string().max(52).nullish(),
  direction: z.enum(GOAL_DIRECTIONS),
  unit: z.string().min(1, 'Единица обязательна.').max(32, 'Единица: максимум 32.'),
  targetValue: z.number().finite('Целевое значение — число.'),
  startValue: z.number().finite('Базовый замер — число.').nullish(),
  deadline: ymd.nullish(),
  fallbackVersion: z.string().max(280).nullish(),
  tradeoff: z.string().max(280).nullish(),
};

/** Схема тела POST /accent/goals (closed-shape). */
export const createGoalSchema = z.object(goalBodyShape).strict();

/** Тип тела создания цели. */
export type CreateGoalDto = z.infer<typeof createGoalSchema>;
