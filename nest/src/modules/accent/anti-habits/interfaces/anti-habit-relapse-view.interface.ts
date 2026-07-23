import type { AntiHabitRelapseFull } from './anti-habit-relapse-full.interface';

/**
 * AntiHabitRelapseView — рецидив наружу (без `antiHabitId` — он в URL). Времена — unix ms
 * (`relapseAt`) + длительность попытки в мс (фронт форматирует «продержался N дн»).
 */
export interface AntiHabitRelapseView {
  /** Идентификатор. */
  id: string;
  /** Момент срыва (unix ms). */
  relapseAt: number;
  /** Длительность завершившейся попытки (мс). */
  attemptDurationMs: number;
  /** Триггер срыва или null. */
  triggerTag: string | null;
  /** Заметка или null. */
  note: string | null;
  /** Когда записано (ISO). */
  createdAt: string;
}

/**
 * Страница истории рецидивов (cursor-пагинация, api-contracts §0/§7): `items` + `nextCursor`
 * (непрозрачный курсор следующей страницы или null, если больше нет).
 */
export interface AntiHabitRelapsePage {
  /** Элементы страницы (новые→старые). */
  items: AntiHabitRelapseView[];
  /** Курсор для следующей страницы или null. */
  nextCursor: string | null;
}

/**
 * Проецирует доменный рецидив наружу.
 * @param full Доменная запись.
 * @returns Проекция наружу.
 */
export function toAntiHabitRelapseView(full: AntiHabitRelapseFull): AntiHabitRelapseView {
  return {
    id: full.id,
    relapseAt: full.relapseAt,
    attemptDurationMs: full.attemptDurationMs,
    triggerTag: full.triggerTag,
    note: full.note,
    createdAt: full.createdAt.toISOString(),
  };
}
