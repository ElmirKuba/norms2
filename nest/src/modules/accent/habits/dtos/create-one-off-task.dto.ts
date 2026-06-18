import { z } from 'zod';
import { HABIT_KINDS } from '../interfaces/habit-full.interface';

/**
 * Схема тела POST /accent/tasks (разовая задача, closed-shape). `occurredOn` — день
 * `YYYY-MM-DD`; `deadline` — ISO-момент (опц.). Кросс-инварианты — domain-service.
 */
export const createOneOffTaskSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(120, 'Название: максимум 120.'),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата: формат YYYY-MM-DD.'),
    kind: z.enum(HABIT_KINDS),
    targetValue: z.number().int('Цель — целое.').min(1, 'Цель ≥ 1.').nullish(),
    category: z.string().max(32).nullish(),
    deadline: z.string().datetime('Дедлайн: ISO-дата.').nullish(),
    priority: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

/** Тип тела создания разовой задачи. */
export type CreateOneOffTaskDto = z.infer<typeof createOneOffTaskSchema>;
