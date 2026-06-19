import type { HabitKind } from './habit-full.interface';
import type { TaskFull, TaskSkipReason, TaskStatus } from './task-full.interface';

/** TaskView — задача наружу (без `accountId`; даты-моменты как ISO-строки). */
export interface TaskView {
  /** Идентификатор. */
  id: string;
  /** Привычка-шаблон или null (разовая). */
  templateId: string | null;
  /** Привязка к цели или null. */
  goalId: string | null;
  /** Название. */
  title: string;
  /** Локальная дата дня `YYYY-MM-DD`. */
  occurredOn: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Целевое значение дня или null. */
  targetValue: number | null;
  /** Сделано (частичное) или null. */
  doneValue: number | null;
  /** Статус. */
  status: TaskStatus;
  /** Причина пропуска или null. */
  skipReason: TaskSkipReason | null;
  /** Приоритет. */
  priority: number;
  /** Категория (для разовых) или null. */
  category: string | null;
  /** Дедлайн (ISO) или null. */
  deadline: string | null;
  /** Момент выполнения (ISO) или null. */
  completedAt: string | null;
}

/** Событие лесенки после выполнения adaptive-привычки: подъём/откат планки или null. */
export type LadderEventView = 'raised' | 'lowered' | null;

/**
 * Результат выполнения задачи (`POST /accent/tasks/:id/complete`): обновлённая задача
 * + что случилось с планкой адаптивной привычки (для фидбэка «планка выросла / мягче»).
 */
export interface CompleteTaskResult {
  /** Обновлённая задача. */
  task: TaskView;
  /** Событие лесенки (raised/lowered) или null (нет движения / manual / разовая). */
  ladderEvent: LadderEventView;
}

/**
 * Проецирует доменную задачу в наружную view (моменты → ISO).
 * @param full Доменная сущность.
 * @returns Проекция наружу.
 */
export function toTaskView(full: TaskFull): TaskView {
  return {
    id: full.id,
    templateId: full.templateId,
    goalId: full.goalId,
    title: full.title,
    occurredOn: full.occurredOn,
    kind: full.kind,
    targetValue: full.targetValue,
    doneValue: full.doneValue,
    status: full.status,
    skipReason: full.skipReason,
    priority: full.priority,
    category: full.category,
    deadline: full.deadline?.toISOString() ?? null,
    completedAt: full.completedAt?.toISOString() ?? null,
  };
}
