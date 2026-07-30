import { z } from 'zod';

/**
 * Схема тела POST /accent/tasks/:id/complete (closed-shape). `doneValue` — сколько
 * сделано (для quantitative/timed); для binary игнорируется. Опц.
 */
export const completeTaskSchema = z
  .object({
    doneValue: z.number().int('Сделано — целое.').min(0, 'Сделано ≥ 0.').optional(),
    /**
     * Явное намерение перезаписать уже записанный результат **меньшим** значением (2.7.1).
     * Шлёт только «Начать сначала» в таймере; без него понижение → `409 TASK_VALUE_DOWNGRADE`.
     */
    replace: z.boolean().optional(),
  })
  .strict();

/** Тип тела отметки выполнения задачи. */
export type CompleteTaskDto = z.infer<typeof completeTaskSchema>;
