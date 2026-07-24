import { z } from 'zod';

/**
 * Тело `PUT /accent/anti-habits/reorder` (ADR-0054, drag-reorder): полный желаемый порядок id
 * видимого списка. Сервер ставит `position = индекс` для своих id (чужие игнорирует).
 */
export const reorderAntiHabitsSchema = z
  .object({
    ids: z.array(z.string().max(52)).max(1000),
  })
  .strict();

/** Тип тела реордера анти-привычек. */
export type ReorderAntiHabitsDto = z.infer<typeof reorderAntiHabitsSchema>;
