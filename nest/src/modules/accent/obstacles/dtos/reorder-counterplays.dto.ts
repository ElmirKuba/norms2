import { z } from 'zod';

/**
 * Тело `PUT /accent/obstacles/:id/counterplays/reorder` (ADR-0054): желаемый порядок ответов
 * внутри препятствия. Авто-сортировки по действенности нет — порядок остаётся за человеком.
 */
export const reorderCounterplaysSchema = z
  .object({
    ids: z.array(z.string().max(52)).max(100),
  })
  .strict();

/** Тип тела реордера контрмер. */
export type ReorderCounterplaysDto = z.infer<typeof reorderCounterplaysSchema>;
