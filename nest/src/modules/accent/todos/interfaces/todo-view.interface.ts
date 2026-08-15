import type { TodoFull, TodoKind, TodoStatus } from './todo-full.interface';
import type { TodoEventFull } from './todo-event-full.interface';

/** Проекция записи наружу (то, что видит фронт). */
export interface TodoView {
  /** Идентификатор. */
  id: string;
  /** Родитель или null. */
  parentId: string | null;
  /** Вид. */
  kind: TodoKind;
  /** Заголовок. */
  title: string;
  /** Заметка. */
  note: string | null;
  /** Состояние. */
  status: TodoStatus;
  /** Когда отмечена выполненной (ISO) или null. */
  completedAt: string | null;
  /** Назначенный день `YYYY-MM-DD` или null. */
  plannedOn: string | null;
  /** Ожидаемое событие или null. */
  waitsForEventId: string | null;
  /** Ожидание даты `YYYY-MM-DD` или null. */
  waitsUntil: string | null;
  /** Метка-бейдж или null. */
  badge: string | null;
  /** В архиве. */
  archived: boolean;
  /** Порядок. */
  position: number;
  /** Подзадачи (у корневых; у самих подзадач — пустой массив). */
  children: TodoView[];
}

/** Проекция события справочника. */
export interface TodoEventView {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Ожидаемая дата или null. */
  expectedOn: string | null;
  /** Состоялось (ISO) или null. */
  happenedAt: string | null;
}

/**
 * Собирает проекцию записи.
 * @param row Строка домена.
 * @param children Подзадачи этой записи.
 * @returns Проекция для фронта.
 */
export function toTodoView(row: TodoFull, children: TodoFull[] = []): TodoView {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind,
    title: row.title,
    note: row.note,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    plannedOn: row.plannedOn,
    waitsForEventId: row.waitsForEventId,
    waitsUntil: row.waitsUntil,
    badge: row.badge,
    archived: row.archivedAt !== null,
    position: row.position,
    children: children.map((child) => toTodoView(child)),
  };
}

/**
 * Собирает проекцию события.
 * @param row Строка домена.
 * @returns Проекция для фронта.
 */
export function toTodoEventView(row: TodoEventFull): TodoEventView {
  return {
    id: row.id,
    title: row.title,
    expectedOn: row.expectedOn,
    happenedAt: row.happenedAt?.toISOString() ?? null,
  };
}
