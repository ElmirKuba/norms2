import { z } from 'zod';

/**
 * Схема тела POST /accent/tasks/:id/complete (closed-shape). `doneValue` — сколько
 * сделано (для quantitative/timed); для binary игнорируется. Опц.
 */
export const completeTaskSchema = z
  .object({
    doneValue: z.number().int('Сделано — целое.').min(0, 'Сделано ≥ 0.').optional(),
  })
  .strict();

/** Тип тела отметки выполнения задачи. */
export type CompleteTaskDto = z.infer<typeof completeTaskSchema>;
