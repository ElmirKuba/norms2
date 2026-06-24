import { z } from 'zod';

/**
 * Тело `PUT /accent/goals/reorder` (ADR-0054, drag-reorder): полный желаемый порядок id видимого
 * списка. Сервер ставит `position = индекс` для своих id (чужие игнорирует).
 */
export const reorderGoalsSchema = z
  .object({
    ids: z.array(z.string().max(52)).max(1000),
  })
  .strict();

/** Тип тела реордера целей. */
export type ReorderGoalsDto = z.infer<typeof reorderGoalsSchema>;
