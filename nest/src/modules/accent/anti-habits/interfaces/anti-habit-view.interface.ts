import type { AntiHabitFull } from './anti-habit-full.interface';

/** Число миллисекунд в сутках — для вычисления серии «сколько держусь». */
const DAY_MS = 86_400_000;

/**
 * AntiHabitView — анти-привычка наружу (без `accountId`/`version`). Времена попытки/рекорда
 * отдаём как unix ms (`*StartedAt`), чтобы фронт считал серию **вживую** (тикающий счётчик).
 * `currentDays`/`recordDays` — снимок на момент ответа (для не-live-потребителей: списки,
 * дашборд). Серия = `floor((now − currentAttemptStartedAt)/сутки)` (domain-model §7).
 */
export interface AntiHabitView {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Описание или null. */
  description: string | null;
  /** Активна ли. */
  isActive: boolean;
  /** Состояние: `active` (серия идёт) или `planned` (старт в будущем, серия ещё не началась). */
  state: 'active' | 'planned';
  /** Старт текущей попытки (unix ms) — для живого счёта серии на фронте; при `planned` — в будущем. */
  currentAttemptStartedAt: number;
  /** Снимок текущей серии в днях на момент ответа (фронт пересчитывает вживую). */
  currentDays: number;
  /** Номер текущей попытки (≥1). */
  attemptNumber: number;
  /** Рекорд серии (дней) — переживает срыв. */
  recordDays: number;
  /** Старт рекордной попытки (unix ms) или null. */
  recordAttemptStartedAt: number | null;
  /** Цель серии в днях или null. */
  targetDays: number | null;
  /** Когда создано (ISO). */
  createdAt: string;
}

/**
 * Проецирует доменную анти-привычку наружу (скрывает accountId/version; времена — ms для
 * живого счёта; `currentDays` — снимок на `now`).
 * @param full Доменная сущность.
 * @param now Текущий момент (unix ms; по умолчанию `Date.now()`).
 * @returns Проекция наружу.
 */
export function toAntiHabitView(full: AntiHabitFull, now: number = Date.now()): AntiHabitView {
  const planned = now < full.currentAttemptStartedAt;
  const elapsedMs = Math.max(0, now - full.currentAttemptStartedAt);
  return {
    id: full.id,
    title: full.title,
    description: full.description,
    isActive: full.isActive,
    state: planned ? 'planned' : 'active',
    currentAttemptStartedAt: full.currentAttemptStartedAt,
    currentDays: Math.floor(elapsedMs / DAY_MS),
    attemptNumber: full.attemptNumber,
    recordDays: full.recordDays,
    recordAttemptStartedAt: full.recordAttemptStartedAt,
    targetDays: full.targetDays,
    createdAt: full.createdAt.toISOString(),
  };
}
