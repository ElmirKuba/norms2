import { z } from 'zod';

/**
 * Схема тела `PATCH /accent/anti-habits/:id` (closed-shape, все поля опциональны). `isActive`
 * — мягкое отключение (`false` = убрать из списка). Пустой объект допустим (no-op).
 */
export const updateAntiHabitSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(160, 'Название: максимум 160.').optional(),
    description: z.string().max(2000, 'Описание: максимум 2000.').nullish(),
    targetDays: z
      .number()
      .int('Цель в днях — целое.')
      .positive('Цель в днях — больше нуля.')
      .max(100_000, 'Цель в днях: слишком большая.')
      .nullish(),
    isActive: z.boolean().optional(),
  })
  .strict();

/** Тип тела обновления анти-привычки. */
export type UpdateAntiHabitDto = z.infer<typeof updateAntiHabitSchema>;
