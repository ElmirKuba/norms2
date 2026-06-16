import { z } from 'zod';

/**
 * Схема тела POST /accent/micro-wins/:id/complete (closed-shape, `.strict`).
 * `occurredOn` опционален — по умолчанию use-case берёт «сегодня» в TZ аккаунта;
 * если задан — формат `YYYY-MM-DD` (бэкдейт выполнения).
 */
export const completeMicroWinSchema = z
  .object({
    occurredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата: формат YYYY-MM-DD.')
      .optional(),
  })
  .strict();

/** Тип тела отметки выполнения. */
export type CompleteMicroWinDto = z.infer<typeof completeMicroWinSchema>;
