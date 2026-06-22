import type { GoalEntryFull } from './goal-entry-full.interface';

/** GoalEntryView — запись прогресса наружу (без `goalId`; дата создания — ISO). */
export interface GoalEntryView {
  /** Идентификатор (он же курсор для пагинации). */
  id: string;
  /** Значение (инкремент/замер). */
  value: number;
  /** Дата записи (YYYY-MM-DD). */
  occurredOn: string;
  /** Заметка или null. */
  note: string | null;
  /** Когда создано (ISO). */
  createdAt: string;
}

/**
 * Проецирует доменную запись в наружную view (дата → ISO).
 * @param full Доменная запись.
 * @returns Проекция наружу.
 */
export function toGoalEntryView(full: GoalEntryFull): GoalEntryView {
  return {
    id: full.id,
    value: full.value,
    occurredOn: full.occurredOn,
    note: full.note,
    createdAt: full.createdAt.toISOString(),
  };
}
