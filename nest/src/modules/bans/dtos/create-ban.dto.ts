import { z } from 'zod';

/**
 * Схема тела POST /bans (closed-shape). targetId — id формата uuidv7___unixmillis
 * (≤52); reason — свободный текст (предупреждение про ПДн в UI), 1–500.
 */
export const createBanSchema = z
  .object({
    targetId: z.string().min(1, 'Цель обязательна.').max(52, 'Некорректный идентификатор цели.'),
    reason: z.string().min(1, 'Причина обязательна.').max(500, 'Причина: максимум 500 символов.'),
  })
  .strict();

/** Тип тела создания бана. */
export type CreateBanDto = z.infer<typeof createBanSchema>;
