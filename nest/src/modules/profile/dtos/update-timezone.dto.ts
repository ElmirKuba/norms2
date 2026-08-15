import { z } from 'zod';

/**
 * Схема тела `POST /accounts/me/timezone` (2.10·A2).
 *
 * Отдельная ручка, а не поле в общем патче профиля: смена пояса **сдвигает границу суток**, и её
 * последствия человек подтверждает двумя окнами. Спрятать такое действие внутрь «сохранить
 * профиль» значило бы сделать его незаметным.
 */
export const updateTimezoneSchema = z
  .object({
    timezone: z.string().min(1, 'Часовой пояс обязателен.').max(64, 'Часовой пояс: максимум 64.'),
  })
  .strict();

/** Тело смены часового пояса. */
export type UpdateTimezoneDto = z.infer<typeof updateTimezoneSchema>;
