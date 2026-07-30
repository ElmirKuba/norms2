import { z } from 'zod';
import { OBSTACLE_TYPES } from '../interfaces/obstacle-full.interface';

/**
 * Схема тела `POST /accent/obstacles` (closed-shape, ADR-0062). `type` **обязателен**: по оси
 * «природа проблемы» подбирает Recommender (2.8), а свободный текст для этого бесполезен.
 * `domainKey` — вторая ось (сфера жизни), опциональна. Свободные поля (`name`/`trigger`/
 * `symptoms`) — «без ПДн» (ADR-0001), подсказка в UI. Инварианты дублирует domain-service.
 */
export const createObstacleSchema = z
  .object({
    name: z.string().min(1, 'Название обязательно.').max(160, 'Название: максимум 160.'),
    type: z.enum(OBSTACLE_TYPES),
    domainKey: z.string().max(64, 'Сфера: максимум 64.').nullish(),
    trigger: z.string().max(2000, 'Повод: максимум 2000.').nullish(),
    symptoms: z.string().max(2000, 'Признаки: максимум 2000.').nullish(),
    intensity: z
      .number()
      .int('Насколько давит — целое.')
      .min(1, 'Насколько давит: от 1.')
      .max(5, 'Насколько давит: до 5.')
      .optional(),
  })
  .strict();

/** Тип тела создания препятствия. */
export type CreateObstacleDto = z.infer<typeof createObstacleSchema>;
