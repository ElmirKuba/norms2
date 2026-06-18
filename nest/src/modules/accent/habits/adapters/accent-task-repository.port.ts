import type { HabitKind } from '../interfaces/habit-full.interface';
import type { TaskFull, TaskSkipReason, TaskStatus } from '../interfaces/task-full.interface';

/** DI-токен порта репозитория задач дня (биндится в habits.module). */
export const ACCENT_TASK_REPOSITORY = Symbol('ACCENT_TASK_REPOSITORY');

/** Данные создания задачи (id/created_at проставляет репозиторий). */
export interface TaskCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название (снимок с привычки или своё для разовой). */
  title: string;
  /** Локальная дата дня `YYYY-MM-DD`. */
  occurredOn: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Привычка-шаблон (`habits.id`) или null (разовая). */
  templateId?: string | null;
  /** Привязка к цели или null. */
  goalId?: string | null;
  /** Снимок `currentTarget` на день или null. */
  targetValue?: number | null;
  /** Сколько сделано (частичное) или null. */
  doneValue?: number | null;
  /** Статус (по умолчанию `pending`). */
  status?: TaskStatus;
  /** Приоритет (по умолчанию 0). */
  priority?: number;
  /** Категория (для разовых) или null. */
  category?: string | null;
  /** Дедлайн (для разовых) или null. */
  deadline?: Date | null;
  /** Из какой задачи перенесена или null. */
  postponedFromTaskId?: string | null;
  /** Момент выполнения или null. */
  completedAt?: Date | null;
  /** Причина пропуска или null. */
  skipReason?: TaskSkipReason | null;
}

/** Патч задачи (жизненный цикл: выполнение/перенос; поля `| undefined`). */
export interface TaskUpdateData {
  status?: TaskStatus | undefined;
  doneValue?: number | null | undefined;
  completedAt?: Date | null | undefined;
  skipReason?: TaskSkipReason | null | undefined;
}

/**
 * Порт репозитория задач дня (per-account), БЕЗ ORM. Всё скоупится по `accountId`.
 * Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentTaskRepositoryPort {
  /**
   * Задачи аккаунта на день (по приоритету, затем дате создания).
   * @param accountId Идентификатор аккаунта.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns Задачи дня владельца.
   */
  listByAccountOn(accountId: string, occurredOn: string): Promise<TaskFull[]>;

  /**
   * Находит задачу по id с проверкой владения.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  findOwned(id: string, accountId: string): Promise<TaskFull | null>;

  /**
   * Создаёт задачу (id генерирует репозиторий).
   * @param data Данные создания.
   * @returns Созданная задача.
   */
  create(data: TaskCreateData): Promise<TaskFull>;

  /**
   * Массовая вставка задач (материализация дня). ON CONFLICT по
   * `(template_id, occurred_on)` DO NOTHING — повторная материализация не плодит дублей.
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  createMany(items: readonly TaskCreateData[]): Promise<number>;

  /**
   * Обновляет задачу владельца (статус/выполнение).
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(id: string, accountId: string, patch: TaskUpdateData): Promise<TaskFull | null>;

  /**
   * Открытые (`pending`/`partial`) разовые задачи (templateId=null) с дедлайном — для
   * расчёта overdue/due-today (фильтрация по дате дедлайна — в domain-service по TZ).
   * @param accountId Идентификатор аккаунта.
   * @returns Открытые разовые задачи с дедлайном.
   */
  listOpenOneOffWithDeadline(accountId: string): Promise<TaskFull[]>;
}
