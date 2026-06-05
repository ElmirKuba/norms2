import { z } from 'zod';

/**
 * Схема тела POST /recovery/questions (closed-shape). Глубокая валидация формата —
 * в VO `SecretQuestion`/`SecretAnswer`; тут только базовые границы.
 */
export const addSecretQuestionSchema = z
  .object({
    question: z.string().min(1, 'Вопрос обязателен.').max(300, 'Вопрос: максимум 300.'),
    answer: z.string().min(1, 'Ответ обязателен.').max(300, 'Ответ: максимум 300.'),
  })
  .strict();

/** Тип тела добавления вопроса. */
export type AddSecretQuestionDto = z.infer<typeof addSecretQuestionSchema>;
