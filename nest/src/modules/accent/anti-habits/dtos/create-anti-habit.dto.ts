import { z } from 'zod';

/**
 * Схема тела `POST /accent/anti-habits` (closed-shape). `targetDays` — положительное целое
 * (цель серии) или null/опущено. Инварианты дублирует domain-service (защита-в-глубину).
 */
export const createAntiHabitSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(160, 'Название: максимум 160.'),
    description: z.string().max(2000, 'Описание: максимум 2000.').nullish(),
    targetDays: z
      .number()
      .int('Цель в днях — целое.')
      .positive('Цель в днях — больше нуля.')
      .max(100_000, 'Цель в днях: слишком большая.')
      .nullish(),
    // Своё время старта (unix ms) — «Указать своё время старта». Прошлое → серия уже идёт;
    // будущее → плановый старт. Обе ветки трактует domain-service; здесь — лишь положит. целое.
    startAt: z.number().int('Дата старта — unix ms.').positive().nullish(),
  })
  .strict();

/** Тип тела создания анти-привычки. */
export type CreateAntiHabitDto = z.infer<typeof createAntiHabitSchema>;
