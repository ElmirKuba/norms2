import { z } from 'zod';

/**
 * Тело `POST /accent/anti-habits/:id/reschedule` (ADR-0059): перенос старта в будущее.
 * `startAt` — unix ms; «строго в будущем» проверяет domain-service (`INVALID_START_DATE`).
 */
export const rescheduleSchema = z
  .object({
    startAt: z.number().int('Дата старта — unix ms.').positive('Дата старта — положительная.'),
  })
  .strict();

/** Тип тела переноса. */
export type RescheduleDto = z.infer<typeof rescheduleSchema>;
