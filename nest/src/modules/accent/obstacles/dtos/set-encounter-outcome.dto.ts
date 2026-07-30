import { z } from 'zod';
import { ENCOUNTER_OUTCOMES } from '../interfaces/obstacle-encounter-full.interface';

/**
 * Схема тела `PATCH /accent/obstacles/:id/encounters/:eid` — проставить исход позже
 * (единственный modify в append-only журнале). Снятие оценки не предусмотрено: «не отмечено»
 * и так не считается негативом, а стирать уже данный ответ незачем.
 */
export const setEncounterOutcomeSchema = z
  .object({
    outcome: z.enum(ENCOUNTER_OUTCOMES),
  })
  .strict();

/** Тип тела проставления исхода. */
export type SetEncounterOutcomeDto = z.infer<typeof setEncounterOutcomeSchema>;
