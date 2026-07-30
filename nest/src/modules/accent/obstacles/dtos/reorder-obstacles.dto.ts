import { z } from 'zod';

/**
 * Тело `PUT /accent/obstacles/reorder` (ADR-0054, drag-reorder): полный желаемый порядок id
 * видимого списка. Сервер ставит `position = индекс` для своих id (чужие игнорирует).
 */
export const reorderObstaclesSchema = z
  .object({
    ids: z.array(z.string().max(52)).max(1000),
  })
  .strict();

/** Тип тела реордера препятствий. */
export type ReorderObstaclesDto = z.infer<typeof reorderObstaclesSchema>;
