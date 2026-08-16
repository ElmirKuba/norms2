import { z } from 'zod';

/**
 * Схема тела `POST /accounts/me/timezone-dismiss` (2.10·A3).
 *
 * `null` означает «забыть прежний отказ» — это не то же самое, что не передать поле: забывание
 * происходит, когда человек вернулся в свой пояс или уехал в третий, и оно должно быть явным
 * действием, а не побочным эффектом.
 */
export const dismissTimezoneSchema = z
  .object({
    timezone: z.string().max(64).nullable(),
  })
  .strict();

/** Тело отказа от предложения сменить пояс. */
export type DismissTimezoneDto = z.infer<typeof dismissTimezoneSchema>;
