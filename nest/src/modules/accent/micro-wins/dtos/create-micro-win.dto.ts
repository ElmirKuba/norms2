import { z } from 'zod';
import {
  MICRO_WIN_CATEGORIES,
  USER_STATES,
} from '../interfaces/micro-win-full.interface';

/**
 * Схема тела POST /accent/micro-wins (closed-shape, `.strict` — лишние поля
 * отвергаются). Границы синхронны с DB-CHECK и domain-service (duration 0..300,
 * energy 1..3). Доменная нормализация (trim title) — в domain-service.
 */
export const createMicroWinSchema = z
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
  })
  .strict();

/** Тип тела создания микро-победы (выводится из схемы). */
export type CreateMicroWinDto = z.infer<typeof createMicroWinSchema>;
