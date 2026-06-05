import { z } from 'zod';

/**
 * Схема тела POST /recovery/complete (closed-shape): логин, ответы на K вопросов
 * (по id) и новый пароль. Число ответов = K сверяет use-case.
 */
export const completeRecoverySchema = z
  .object({
    login: z.string().min(1, 'Логин обязателен.').max(32, 'Логин: максимум 32.'),
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(52),
            answer: z.string().min(1, 'Ответ обязателен.').max(300, 'Ответ: максимум 300.'),
          })
          .strict(),
      )
      .min(1, 'Нужен хотя бы один ответ.')
      .max(50, 'Слишком много ответов.'),
    newPassword: z.string().min(3, 'Пароль: минимум 3.').max(64, 'Пароль: максимум 64.'),
  })
  .strict();

/** Тип тела завершения восстановления. */
export type CompleteRecoveryDto = z.infer<typeof completeRecoverySchema>;
