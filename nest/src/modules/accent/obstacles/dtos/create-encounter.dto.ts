import { z } from 'zod';
import { ENCOUNTER_OUTCOMES } from '../interfaces/obstacle-encounter-full.interface';

/**
 * Схема тела `POST /accent/obstacles/:id/encounters` (closed-shape, ADR-0062). **Все поля
 * опциональны** — это главный поток раздела: в плохую минуту человек должен получить помощь
 * за один тап, а не заполнить анкету. Без `counterplayId` — «просто отметить»; `outcome`
 * можно проставить позже отдельным запросом.
 */
export const createEncounterSchema = z
  .object({
    counterplayId: z.string().max(52, 'Некорректная контрмера.').nullish(),
    outcome: z.enum(ENCOUNTER_OUTCOMES).nullish(),
    note: z.string().max(2000, 'Заметка: максимум 2000.').nullish(),
    // Момент столкновения (unix ms, опц.) — по умолчанию «сейчас». Backfill за прошлое
    // допустим: человек может отметить вечером то, что случилось днём.
    occurredAt: z.number().int('Момент — unix ms.').positive().nullish(),
  })
  .strict();

/** Тип тела записи столкновения. */
export type CreateEncounterDto = z.infer<typeof createEncounterSchema>;
