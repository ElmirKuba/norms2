import { z } from 'zod';

/**
 * Схема тела PUT /recovery/required-count (closed-shape). Диапазон `1 ≤ K ≤ N`
 * (N — число вопросов) проверяет use-case кросс-доменно; тут — что это целое > 0.
 */
export const setRequiredCountSchema = z
  .object({
    requiredCount: z.number().int('K — целое.').positive('K должно быть положительным.'),
  })
  .strict();

/** Тип тела установки K. */
export type SetRequiredCountDto = z.infer<typeof setRequiredCountSchema>;
