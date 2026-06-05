import { z } from 'zod';

/** Схема тела POST /recovery/start (closed-shape): логин для выдачи K вопросов. */
export const startRecoverySchema = z
  .object({
    login: z.string().min(1, 'Логин обязателен.').max(32, 'Логин: максимум 32.'),
  })
  .strict();

/** Тип тела старта восстановления. */
export type StartRecoveryDto = z.infer<typeof startRecoverySchema>;
