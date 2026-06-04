import { z } from 'zod';

/**
 * Схема тела POST /invites/check (closed-shape). code — с дефисами или без
 * (нормализуется в VO).
 */
export const checkInviteSchema = z
  .object({
    code: z.string().min(1, 'Код обязателен.').max(20),
  })
  .strict();

/** Тип тела проверки кода. */
export type CheckInviteDto = z.infer<typeof checkInviteSchema>;
