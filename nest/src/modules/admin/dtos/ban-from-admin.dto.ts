import { z } from 'zod';

/**
 * Тело `POST /admin/bans` (2.9.3·26). Причина **обязательна** и здесь: человек прочитает её при
 * попытке входа, и «забанен без объяснения» — худшее, что продукт может ему сказать.
 */
export const banFromAdminSchema = z
  .object({
    targetId: z.string().min(1, 'Цель обязательна.').max(52, 'Некорректный идентификатор цели.'),
    reason: z.string().min(1, 'Причина обязательна.').max(500, 'Причина: максимум 500 символов.'),
  })
  .strict();

/** Тип тела бана из админки. */
export type BanFromAdminDto = z.infer<typeof banFromAdminSchema>;
