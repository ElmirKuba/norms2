import { z } from 'zod';

// Преобразование строки 'true'|'false' из окружения в boolean.
const booleanFromEnv = z
  .enum(['true', 'false'])
  .transform((value: 'true' | 'false'): boolean => value === 'true');

/**
 * Схема всех переменных окружения приложения. Источник истины по конфигу:
 * что не описано здесь — в ConfigService не попадёт. Числа/булевы коэрсятся
 * из строк env.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  BACKEND_PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_PORT: z.coerce.number().int().positive().default(4200),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  ACCESS_TTL: z.string().min(1).default('15m'),
  REFRESH_TTL: z.string().min(1).default('30d'),
  COOKIE_SECURE: booleanFromEnv.default(false),

  FREE_REGISTRATION: booleanFromEnv.default(false),
  INVITE_DEFAULT_QUOTA: z.coerce.number().int().nonnegative().default(3),
  INVITE_TTL_DAYS: z.coerce.number().int().positive().default(3),
  AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(512_000),
  OPTIMISTIC_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
});

/** Тип валидированного окружения (выводится из схемы). */
export type Env = z.infer<typeof envSchema>;

/**
 * Валидирует сырое окружение по схеме (fail-fast). Бросает Error с перечнем
 * проблем, если что-то невалидно — тогда приложение не стартует.
 * @param rawEnv Сырой объект переменных окружения (process.env).
 * @returns Типизированное валидированное окружение.
 * @throws {Error} Если переменные окружения не проходят валидацию.
 */
export function validateEnv(rawEnv: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue: z.core.$ZodIssue): string => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Невалидные переменные окружения:\n${details}`);
  }
  return parsed.data;
}
