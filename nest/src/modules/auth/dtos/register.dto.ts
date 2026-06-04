import { z } from 'zod';

/**
 * Схема тела POST /auth/register (closed-shape, .strict — лишние поля отвергаются).
 * Первый барьер валидации формата; доменные инварианты — в VO (reserved-list,
 * нормализация alias и т.п.).
 */
export const registerSchema = z
  .object({
    login: z.string().regex(/^[a-zA-Z0-9_]{3,32}$/, 'Логин: 3–32 символа [A-Za-z0-9_].'),
    alias: z.string().min(3, 'Псевдоним: минимум 3.').max(32, 'Псевдоним: максимум 32.'),
    password: z.string().min(3, 'Пароль: минимум 3.').max(64, 'Пароль: максимум 64.'),
    inviteCode: z.string().optional(),
  })
  .strict();

/** Тип тела регистрации (выводится из схемы). */
export type RegisterDto = z.infer<typeof registerSchema>;
