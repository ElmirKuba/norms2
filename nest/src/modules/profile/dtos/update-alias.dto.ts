import { z } from 'zod';

/**
 * Схема тела PATCH /accounts/me (closed-shape). Глубокая валидация (Unicode-буквы/
 * цифры/пробел/дефис, нормализация) — в VO `Alias`; тут только границы длины.
 */
export const updateAliasSchema = z
  .object({
    alias: z.string().min(3, 'Псевдоним: минимум 3.').max(32, 'Псевдоним: максимум 32.'),
  })
  .strict();

/** Тип тела смены псевдонима. */
export type UpdateAliasDto = z.infer<typeof updateAliasSchema>;
