import { z } from 'zod';
import {
  MICRO_WIN_CATEGORIES,
  USER_STATES,
} from '../interfaces/micro-win-full.interface';

/**
 * Схема тела PATCH /accent/micro-wins/:id (closed-shape, `.strict`). Все поля
 * опциональны (частичный патч); дополнительно `isActive` — мягкое вкл/выкл.
 * Применяются только переданные поля; владение проверяет domain-service.
 */
export const updateMicroWinSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(120, 'Название: максимум 120.'),
    category: z.enum(MICRO_WIN_CATEGORIES),
    durationSeconds: z
      .number()
      .int('Длительность — целое.')
      .min(0, 'Длительность ≥ 0.')
      .max(300, 'Длительность: максимум 300 секунд.'),
    energyCost: z.number().int('Цена энергии — целое.').min(1, 'Цена энергии ≥ 1.').max(3, 'Цена энергии ≤ 3.'),
    effect: z.string().max(280, 'Эффект: максимум 280.').nullish(),
    disabledForStates: z.array(z.enum(USER_STATES)).nullish(),
    isActive: z.boolean(),
  })
  .partial()
  .strict();

/** Тип тела обновления микро-победы (выводится из схемы). */
export type UpdateMicroWinDto = z.infer<typeof updateMicroWinSchema>;
