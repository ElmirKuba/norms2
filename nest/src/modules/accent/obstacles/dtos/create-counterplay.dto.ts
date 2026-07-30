import { z } from 'zod';

/**
 * Схема тела `POST /accent/obstacles/:id/counterplays` (closed-shape, ADR-0062). Контрмера —
 * **свой** ответ, поэтому текст свободный («без ПДн», ADR-0001). `linkedMicroWinId` делает
 * ответ запускаемым: в момент столкновения откроется таймер микро-победы (ADR-0057);
 * существование и принадлежность проверяет domain-service микро-побед (кросс-домен вниз).
 */
export const createCounterplaySchema = z
  .object({
    text: z.string().min(1, 'Текст контрмеры обязателен.').max(500, 'Контрмера: максимум 500.'),
    linkedMicroWinId: z.string().max(52, 'Некорректная микро-победа.').nullish(),
  })
  .strict();

/** Тип тела создания контрмеры. */
export type CreateCounterplayDto = z.infer<typeof createCounterplaySchema>;
