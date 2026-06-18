import { z } from 'zod';
import { HABIT_KINDS, LADDER_POLICIES } from '../interfaces/habit-full.interface';

/** Схема лесенки в теле (цели + политика; счётчики ставит бэк). Кросс-поля — domain-service. */
const ladderSchema = z
  .object({
    minTarget: z.number().int('minTarget — целое.').min(1, 'minTarget ≥ 1.'),
    currentTarget: z.number().int('currentTarget — целое.').min(1, 'currentTarget ≥ 1.'),
    goalTarget: z.number().int('goalTarget — целое.').min(1, 'goalTarget ≥ 1.').nullish(),
    step: z.number().int('step — целое.').min(1, 'step ≥ 1.').nullish(),
    policy: z.enum(LADDER_POLICIES),
  })
  .strict();

/**
 * Поля привычки в теле (база для create/update). `recurrence` — RRULE (домен проверяет
 * `FREQ=`, полный разбор — 2.4·6). Кросс-инварианты лесенки — domain-service.
 */
export const habitBodyShape = {
  title: z.string().min(1, 'Название обязательно.').max(120, 'Название: максимум 120.'),
  description: z.string().max(2000).nullish(),
  icon: z.string().max(32).nullish(),
  domainKey: z.string().max(64).nullish(),
  attributes: z.array(z.string().max(64)).max(20).optional(),
  goalId: z.string().max(52).nullish(),
  priority: z.number().int().min(0).max(1000).optional(),
  kind: z.enum(HABIT_KINDS),
  recurrence: z.string().min(1, 'Расписание обязательно.').max(500),
  ladder: ladderSchema,
  minVersion: z.string().max(280).nullish(),
};

/** Схема тела POST /accent/habits (closed-shape). */
export const createHabitSchema = z.object(habitBodyShape).strict();

/** Тип тела создания привычки. */
export type CreateHabitDto = z.infer<typeof createHabitSchema>;
