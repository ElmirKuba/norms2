import { z } from 'zod';

/**
 * Схема тела POST /auth/login (closed-shape). На входе только присутствие/санити
 * (формат не валидируем — неверные данные дают единый 401, не 400).
 */
export const loginSchema = z
  .object({
    login: z.string().min(1, 'Логин обязателен.').max(32),
    password: z.string().min(1, 'Пароль обязателен.').max(64),
  })
  .strict();

/** Тип тела входа (выводится из схемы). */
export type LoginDto = z.infer<typeof loginSchema>;
