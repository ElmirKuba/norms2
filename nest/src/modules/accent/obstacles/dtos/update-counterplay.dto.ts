import { z } from 'zod';

/**
 * Схема тела `PATCH /accent/obstacles/:id/counterplays/:cid` (closed-shape, все поля опц.).
 * `linkedMicroWinId: null` — снять привязку (ответ останется текстом).
 */
export const updateCounterplaySchema = z
  .object({
    text: z
      .string()
      .min(1, 'Текст контрмеры обязателен.')
      .max(500, 'Контрмера: максимум 500.')
      .optional(),
    linkedMicroWinId: z.string().max(52, 'Некорректная микро-победа.').nullish(),
  })
  .strict();

/** Тип тела обновления контрмеры. */
export type UpdateCounterplayDto = z.infer<typeof updateCounterplaySchema>;
