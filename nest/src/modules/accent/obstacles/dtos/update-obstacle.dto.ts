import { z } from 'zod';
import { OBSTACLE_TYPES } from '../interfaces/obstacle-full.interface';

/**
 * Схема тела `PATCH /accent/obstacles/:id` (closed-shape, все поля опциональны). `isActive:
 * false` = «убрать из списка» (архив; история цела). Правка примера присваивает его —
 * adoption, ADR-0051 (флаг `isStarter` снимает domain-service, из API он не принимается).
 * Пустой объект допустим (no-op).
 */
export const updateObstacleSchema = z
  .object({
    name: z.string().min(1, 'Название обязательно.').max(160, 'Название: максимум 160.').optional(),
    type: z.enum(OBSTACLE_TYPES).optional(),
    domainKey: z.string().max(64, 'Сфера: максимум 64.').nullish(),
    trigger: z.string().max(2000, 'Повод: максимум 2000.').nullish(),
    symptoms: z.string().max(2000, 'Признаки: максимум 2000.').nullish(),
    intensity: z
      .number()
      .int('Насколько давит — целое.')
      .min(1, 'Насколько давит: от 1.')
      .max(5, 'Насколько давит: до 5.')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/** Тип тела обновления препятствия. */
export type UpdateObstacleDto = z.infer<typeof updateObstacleSchema>;
