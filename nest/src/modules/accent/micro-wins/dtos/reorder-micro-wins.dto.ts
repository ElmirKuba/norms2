import { z } from 'zod';

/** Тело `PUT /accent/micro-wins/reorder` (ADR-0054): желаемый порядок id видимого списка. */
export const reorderMicroWinsSchema = z
  .object({
    ids: z.array(z.string().max(52)).max(1000),
  })
  .strict();

/** Тип тела реордера микро-побед. */
export type ReorderMicroWinsDto = z.infer<typeof reorderMicroWinsSchema>;
