import type { HabitKind } from './habit-full.interface';

/** Статус задачи дня (domain-model §5). */
export const TASK_STATUSES = ['pending', 'done', 'partial', 'skipped'] as const;

/** Статус задачи (производно от `TASK_STATUSES`). */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Причина пропуска: `postponed` (перенесена) или `cancelled` (отменена). */
export const TASK_SKIP_REASONS = ['postponed', 'cancelled'] as const;

/** Причина пропуска (производно от `TASK_SKIP_REASONS`). */
export type TaskSkipReason = (typeof TASK_SKIP_REASONS)[number];

/**
 * TaskFull — задача дня (инстанс привычки или разовая; колонки 1:1 со схемой, ADR-0033).
 * Материализуется из активной привычки по RRULE на день (`templateId` задан), либо
 * создаётся как разовая (one-off, `templateId=null`, с `category?`/`deadline?`).
 * **Инвариант:** уник `(templateId, occurredOn)` — 1 инстанс привычки на день.
 * `partial` при `doneValue ≥ minTarget` засчитывается как победа (логика — 2.4·9).
 */
export interface TaskFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Привычка-шаблон (`habits.id`) или null (разовая задача). */
  templateId: string | null;
  /** Привязка к цели (`goals.id`) или null (FK появится с `goals`, 2.5). */
  goalId: string | null;
  /** Название (снимок с привычки или своё для разовой). */
  title: string;
  /** Локальная дата дня `YYYY-MM-DD` (в TZ аккаунта). */
  occurredOn: string;
  /** Тип измерения (снимок с привычки / выбран для разовой). */
  kind: HabitKind;
  /** Снимок `currentTarget` на день (или null для binary). */
  targetValue: number | null;
  /** Сколько фактически сделано (частичное выполнение) или null. */
  doneValue: number | null;
  /** Статус. */
  status: TaskStatus;
  /** Причина пропуска (если `skipped`) или null. */
  skipReason: TaskSkipReason | null;
  /** Из какой задачи перенесена (мягкая ссылка на `tasks.id`) или null. */
  postponedFromTaskId: string | null;
  /** Приоритет (сортировка). */
  priority: number;
  /** Категория (для разовых) или null. */
  category: string | null;
  /** Дедлайн (для разовых) или null. */
  deadline: Date | null;
  /** Момент выполнения (для done/partial) или null. */
  completedAt: Date | null;
  /** Когда создано/материализовано. */
  createdAt: Date;
}
