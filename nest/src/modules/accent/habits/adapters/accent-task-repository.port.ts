import type { HabitKind } from '../interfaces/habit-full.interface';
import type {
  TaskFull,
  TaskLadderSnapshot,
  TaskSkipReason,
  TaskStatus,
} from '../interfaces/task-full.interface';
import type { Transaction } from '../../../../shared/transactions/transaction.interface';

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
  /** Снимок лесенки «до отметки» (2.7.3): пишется при complete, гасится при отмене. */
  ladderBefore?: TaskLadderSnapshot | null | undefined;
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
   * @param tx Опц. транзакция.
   * @returns Созданная задача.
   */
  create(data: TaskCreateData, tx?: Transaction): Promise<TaskFull>;

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
   * @param tx Опц. транзакция.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(
    id: string,
    accountId: string,
    patch: TaskUpdateData,
    tx?: Transaction,
  ): Promise<TaskFull | null>;

  /**
   * Условный переход «открытой» задачи (`pending`/`skipped`) — атомарно. Применяет patch
   * только если задача открыта; возвращает строку, если переход произошёл (идемпотентное
   * движение лесенки: ровно один из параллельных complete получит строку).
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (уже не открыта / нет / не ваша).
   */
  updateIfOpen(id: string, accountId: string, patch: TaskUpdateData): Promise<TaskFull | null>;

  /**
   * Открытые (`pending`/`partial`) разовые задачи (templateId=null) с дедлайном — для
   * расчёта overdue/due-today (фильтрация по дате дедлайна — в domain-service по TZ).
   * @param accountId Идентификатор аккаунта.
   * @returns Открытые разовые задачи с дедлайном.
   */
  listOpenOneOffWithDeadline(accountId: string): Promise<TaskFull[]>;

  /**
   * Удаляет ещё не тронутые (`pending`) задачи привычки-шаблона (при деактивации).
   * Выполненные/частичные/пропущенные (`done`/`partial`/`skipped`) НЕ трогает — история.
   * @param templateId Идентификатор привычки-шаблона.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  deleteOpenByTemplate(templateId: string, accountId: string, today: string): Promise<number>;

  /**
   * Удаляет одну свою задачу (2.7.2 — откат переноса убирает завтрашнюю копию).
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param tx Опц. транзакция.
   * @returns true, если строка была удалена.
   */
  deleteOwned(id: string, accountId: string, tx?: Transaction): Promise<boolean>;

  /**
   * История задач одной привычки-шаблона (2.7.3) — **только чтение, ничего не создаёт**.
   * Keyset-пагинация: страница = `limit` записей строго старше курсора `before`, от свежих к
   * старым. Offset не используем — он поедет при вставках.
   * @param templateId Идентификатор привычки-шаблона.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param options `before` — исключающий курсор (`YYYY-MM-DD`), `limit` — сколько вернуть.
   * @returns Задачи по убыванию `occurredOn`.
   */
  listByTemplate(
    templateId: string,
    accountId: string,
    options: { before?: string; limit: number },
  ): Promise<TaskFull[]>;

  /**
   * Последний день, когда привычку реально отметили (`done`/`partial`) — для «последняя отметка
   * N дней назад» (2.7.3). Отдельным запросом: в страницу истории такой день может не попасть.
   * @param templateId Идентификатор привычки-шаблона.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Дата `YYYY-MM-DD` или null, если отметок не было ни разу.
   */
  findLastMarkedOn(templateId: string, accountId: string): Promise<string | null>;

  /**
   * Отмечал ли человек хоть когда-нибудь хоть одну задачу (2.11) — для шага онбординга на
   * дашборде. Одним EXISTS: считать все отметки ради булева флага незачем.
   * @param accountId Идентификатор аккаунта.
   * @returns true, если есть хотя бы одна `done`/`partial`.
   */
  hasAnyCompletion(accountId: string): Promise<boolean>;

  /**
   * Дни, в которые была закрыта хотя бы одна задача (`done`/`partial`) — источник постоянства
   * (2.9). Возвращает **различные даты по возрастанию**, а не количество: объединять их с днями
   * микро-побед и записей целей приходится в домене, и суммой счётчиков это не считается —
   * дни пересекаются.
   * @param accountId Идентификатор аккаунта.
   * @param templateId Опц. привычка-шаблон — тогда только её дни (постоянство одной привычки).
   * @returns Даты `YYYY-MM-DD` по возрастанию.
   */
  listActiveDays(accountId: string, templateId?: string): Promise<string[]>;
}
