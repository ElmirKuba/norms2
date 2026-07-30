import { z } from 'zod';

/**
 * Схема тела `POST /accent/anti-habits/:id/relapse` (closed-shape). Оба поля свободные и
 * опциональные → подсказка «без ПДн» (ui-ux §9). Тело может быть пустым (`{}`).
 */
export const relapseSchema = z
  .object({
    triggerTag: z.string().max(120, 'Триггер: максимум 120.').nullish(),
    note: z.string().max(2000, 'Заметка: максимум 2000.').nullish(),
    /**
     * Препятствие, из-за которого сорвался (опц., ADR-0062 п.9, подфаза 2.7). Дополняет
     * свободный `triggerTag`: список — для того, что уже названо, текст — для остального.
     */
    obstacleId: z.string().max(52, 'Некорректное препятствие.').nullish(),
  })
  .strict();

/** Тип тела рецидива. */
export type RelapseDto = z.infer<typeof relapseSchema>;
