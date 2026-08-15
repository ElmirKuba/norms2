import type { TodoFull, TodoKind } from '../interfaces/todo-full.interface';
import type { TodoEventFull } from '../interfaces/todo-event-full.interface';

/** DI-токен порта репозитория дел (биндится в `todos.module`). */
export const ACCENT_TODO_REPOSITORY = Symbol('ACCENT_TODO_REPOSITORY');

/** Данные создания записи (id, таймстампы и позицию проставляет репозиторий). */
export interface TodoCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Вид: идея, дело или покупка. */
  kind: TodoKind;
  /** Заголовок — единственное обязательное поле. */
  title: string;
  /** Родитель (подзадача) или null. */
  parentId?: string | null;
  /** Свободная заметка. */
  note?: string | null;
  /** Назначенный день `YYYY-MM-DD`. */
  plannedOn?: string | null;
  /** Ожидаемое событие (мягкая ссылка на `todo_events.id`). */
  waitsForEventId?: string | null;
  /** Ожидание даты `YYYY-MM-DD`. */
  waitsUntil?: string | null;
  /** Метка-бейдж. */
  badge?: string | null;
}

/**
 * Частичный патч записи (только переданные поля; владение проверяет домен).
 * `undefined` допускается ради совместимости с zod `.partial()` — domain-service собирает
 * чистый объект только из определённых ключей.
 */
export interface TodoUpdateData {
  kind?: TodoKind | undefined;
  title?: string | undefined;
  note?: string | null | undefined;
  plannedOn?: string | null | undefined;
  waitsForEventId?: string | null | undefined;
  waitsUntil?: string | null | undefined;
  badge?: string | null | undefined;
}

/** Данные создания события справочника. */
export interface TodoEventCreateData {
  /** Владелец. */
  accountId: string;
  /** Название («приедет сварщик»). */
  title: string;
  /** Ожидаемая дата `YYYY-MM-DD` (опц. — бывает «когда позвонят»). */
  expectedOn?: string | null;
}

/** Патч события справочника. */
export interface TodoEventUpdateData {
  title?: string | undefined;
  expectedOn?: string | null | undefined;
}

/**
 * Порт хранилища дел и событий (2.10, блок C).
 *
 * Дела и события держатся одним портом намеренно: событие не имеет смысла без дел, которые его
 * ждут, а разнесённые порты заставили бы use-case ходить в два адаптера ради одного экрана.
 */
export interface AccentTodoRepositoryPort {
  /**
   * Записи владельца одного вида.
   * @param accountId Идентификатор аккаунта.
   * @param kind Вид записи.
   * @param archived `true` — показать архив вместо живых.
   * @returns Записи в порядке отображения.
   */
  listByKind(accountId: string, kind: TodoKind, archived: boolean): Promise<TodoFull[]>;

  /**
   * Подзадачи нескольких записей разом — чтобы экран не делал запрос на каждую строку.
   * @param accountId Идентификатор аккаунта.
   * @param parentIds Идентификаторы родителей.
   * @returns Подзадачи в порядке отображения.
   */
  listChildren(accountId: string, parentIds: string[]): Promise<TodoFull[]>;

  /**
   * Запись по идентификатору с проверкой владения.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Запись или null.
   */
  findOwned(id: string, accountId: string): Promise<TodoFull | null>;

  /**
   * Создаёт запись.
   * @param data Данные создания.
   * @returns Созданная запись.
   */
  create(data: TodoCreateData): Promise<TodoFull>;

  /**
   * Обновляет поля записи.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Изменяемые поля.
   * @returns Обновлённая запись или null, если не найдена.
   */
  update(id: string, accountId: string, patch: TodoUpdateData): Promise<TodoFull | null>;

  /**
   * Ставит или снимает отметку выполнения.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param done `true` — выполнена.
   * @returns Обновлённая запись или null.
   */
  setDone(id: string, accountId: string, done: boolean): Promise<TodoFull | null>;

  /**
   * Отправляет в архив или возвращает из него.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param archived `true` — в архив.
   * @returns Обновлённая запись или null.
   */
  setArchived(id: string, accountId: string, archived: boolean): Promise<TodoFull | null>;

  /**
   * Удаляет запись вместе с подзадачами (каскад — по карте владения).
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns `true`, если удалена.
   */
  delete(id: string, accountId: string): Promise<boolean>;

  /**
   * Переставляет записи в заданном порядке.
   * @param accountId Идентификатор аккаунта.
   * @param orderedIds Идентификаторы в новом порядке.
   * @returns Промис завершения.
   */
  reorder(accountId: string, orderedIds: string[]): Promise<void>;

  /**
   * События справочника.
   * @param accountId Идентификатор аккаунта.
   * @param includeHappened Включать ли состоявшиеся.
   * @returns События владельца.
   */
  listEvents(accountId: string, includeHappened: boolean): Promise<TodoEventFull[]>;

  /**
   * Событие по идентификатору с проверкой владения.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Событие или null.
   */
  findOwnedEvent(id: string, accountId: string): Promise<TodoEventFull | null>;

  /**
   * Создаёт событие.
   * @param data Данные создания.
   * @returns Созданное событие.
   */
  createEvent(data: TodoEventCreateData): Promise<TodoEventFull>;

  /**
   * Обновляет событие.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Изменяемые поля.
   * @returns Обновлённое событие или null.
   */
  updateEvent(id: string, accountId: string, patch: TodoEventUpdateData): Promise<TodoEventFull | null>;

  /**
   * Отмечает событие состоявшимся (или снимает отметку).
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param happened `true` — состоялось.
   * @returns Обновлённое событие или null.
   */
  setEventHappened(id: string, accountId: string, happened: boolean): Promise<TodoEventFull | null>;

  /**
   * Удаляет событие.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns `true`, если удалено.
   */
  deleteEvent(id: string, accountId: string): Promise<boolean>;

  /**
   * Снимает ожидание у всех записей, ждавших это событие.
   *
   * Нужно при «событие состоялось» и при удалении события: иначе дела остались бы висеть в
   * ожидании того, чего больше нет, — а мягкая ссылка без проверки живости и есть тот самый
   * ярлык-призрак (ADR-0068).
   * @param accountId Идентификатор аккаунта.
   * @param eventId Идентификатор события.
   * @returns Сколько записей освободилось.
   */
  releaseWaiting(accountId: string, eventId: string): Promise<number>;
}
