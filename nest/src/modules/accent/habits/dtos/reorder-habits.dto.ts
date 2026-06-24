import { z } from 'zod';

/** Тело `PUT /accent/habits/reorder` (ADR-0054): желаемый порядок id видимого списка. */
export const reorderHabitsSchema = z
  .object({
    ids: z.array(z.string().max(52)).max(1000),
  })
  .strict();

/** Тип тела реордера привычек. */
export type ReorderHabitsDto = z.infer<typeof reorderHabitsSchema>;
