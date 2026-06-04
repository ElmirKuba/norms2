import { z } from 'zod';

/**
 * Схема тела POST /invites (closed-shape). reason — свободный текст (предупреждение
 * про ПДн в UI), 1–500.
 */
export const createInviteSchema = z
  .object({
    reason: z.string().min(1, 'Причина обязательна.').max(500, 'Причина: максимум 500 символов.'),
  })
  .strict();

/** Тип тела создания инвайта. */
export type CreateInviteDto = z.infer<typeof createInviteSchema>;
