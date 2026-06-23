import { z } from 'zod';

/**
 * Схема тела POST /accent/goals/:id/milestones (closed-shape). Границы порога (≤ цель для
 * accumulate) проверяет домен.
 */
export const addMilestoneSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(160, 'Название: максимум 160.'),
    thresholdValue: z.number().finite('Порог — число.'),
  })
  .strict();

/** Тип тела добавления вехи. */
export type AddMilestoneDto = z.infer<typeof addMilestoneSchema>;
