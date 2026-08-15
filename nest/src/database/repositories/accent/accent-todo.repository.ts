import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { deleteCascade } from '../../core/deletion.engine';
import { alive } from '../../core/alive.util';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { todos } from '../../schemas/todos.schema';
import { todoEvents } from '../../schemas/todo-events.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentTodoRepositoryPort,
  TodoCreateData,
  TodoEventCreateData,
  TodoEventUpdateData,
  TodoUpdateData,
} from '../../../modules/accent/todos/adapters/accent-todo-repository.port';
import type { TodoFull, TodoKind } from '../../../modules/accent/todos/interfaces/todo-full.interface';
import type { TodoEventFull } from '../../../modules/accent/todos/interfaces/todo-event-full.interface';

/**
 * Drizzle-реализация порта дел и событий (единственное место с ORM). Строки структурно совпадают
 * с `TodoFull`/`TodoEventFull` (колонки 1:1) → маппинг прямой. Все запросы скоупятся по
 * `account_id`. Биндится на `ACCENT_TODO_REPOSITORY`.
 */
@Injectable()
export class AccentTodoRepository implements AccentTodoRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Корневые записи владельца одного вида.
   * @param accountId Идентификатор аккаунта.
   * @param kind Вид записи.
   * @param archived `true` — архив вместо живых.
   * @returns Записи в порядке отображения.
   */
  public async listByKind(accountId: string, kind: TodoKind, archived: boolean): Promise<TodoFull[]> {
    return this._db
      .select()
      .from(todos)
      .where(
        and(
          alive(todos),
          eq(todos.accountId, accountId),
          eq(todos.kind, kind),
          isNull(todos.parentId),
          archived ? sql`${todos.archivedAt} is not null` : isNull(todos.archivedAt),
        ),
      )
      // Выполненные уходят вниз, но остаются в списке: «что я уже сделал» — тоже информация.
      // Тай-брейкер по id (uuidv7 ≈ порядок вставки) держит порядок стабильным при равных
      // position — иначе строка «прыгает» после каждой правки.
      .orderBy(asc(todos.status), asc(todos.position), asc(todos.createdAt), asc(todos.id));
  }

  /**
   * Подзадачи нескольких записей разом.
   * @param accountId Идентификатор аккаунта.
   * @param parentIds Идентификаторы родителей.
   * @returns Подзадачи в порядке отображения.
   */
  public async listChildren(accountId: string, parentIds: string[]): Promise<TodoFull[]> {
    if (parentIds.length === 0) {
      return [];
    }
    return this._db
      .select()
      .from(todos)
      .where(
        and(
          alive(todos),
          eq(todos.accountId, accountId),
          inArray(todos.parentId, parentIds),
          isNull(todos.archivedAt),
        ),
      )
      .orderBy(asc(todos.status), asc(todos.position), asc(todos.createdAt), asc(todos.id));
  }

  /**
   * Запись по идентификатору с проверкой владения.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Запись или null.
   */
  public async findOwned(id: string, accountId: string): Promise<TodoFull | null> {
    const [row] = await this._db
      .select()
      .from(todos)
      .where(and(alive(todos), eq(todos.id, id), eq(todos.accountId, accountId)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Создаёт запись; позиция — в конец своего уровня.
   * @param data Данные создания.
   * @returns Созданная запись.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: TodoCreateData): Promise<TodoFull> {
    const [maxRow] = await this._db
      .select({ max: sql<number>`coalesce(max(${todos.position}), -1)` })
      .from(todos)
      .where(
        and(
          alive(todos),
          eq(todos.accountId, data.accountId),
          eq(todos.kind, data.kind),
          data.parentId == null ? isNull(todos.parentId) : eq(todos.parentId, data.parentId),
        ),
      );
    const rows = await this._db
      .insert(todos)
      .values({
        id: generateId(),
        accountId: data.accountId,
        parentId: data.parentId ?? null,
        kind: data.kind,
        title: data.title,
        note: data.note ?? null,
        status: 'open',
        completedAt: null,
        plannedOn: data.plannedOn ?? null,
        waitsForEventId: data.waitsForEventId ?? null,
        waitsUntil: data.waitsUntil ?? null,
        badge: data.badge ?? null,
        archivedAt: null,
        position: (maxRow?.max ?? -1) + 1,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('todos: create не вернул строку.');
    }
    return row;
  }

  /**
   * Обновляет поля записи.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Изменяемые поля.
   * @returns Обновлённая запись или null.
   */
  public async update(id: string, accountId: string, patch: TodoUpdateData): Promise<TodoFull | null> {
    const [row] = await this._db
      .update(todos)
      .set(patch)
      .where(and(alive(todos), eq(todos.id, id), eq(todos.accountId, accountId)))
      .returning();
    return row ?? null;
  }

  /**
   * Ставит или снимает отметку выполнения.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param done `true` — выполнена.
   * @returns Обновлённая запись или null.
   */
  public async setDone(id: string, accountId: string, done: boolean): Promise<TodoFull | null> {
    const [row] = await this._db
      .update(todos)
      .set({ status: done ? 'done' : 'open', completedAt: done ? new Date() : null })
      .where(and(alive(todos), eq(todos.id, id), eq(todos.accountId, accountId)))
      .returning();
    return row ?? null;
  }

  /**
   * Отправляет в архив или возвращает.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param archived `true` — в архив.
   * @returns Обновлённая запись или null.
   */
  public async setArchived(id: string, accountId: string, archived: boolean): Promise<TodoFull | null> {
    const [row] = await this._db
      .update(todos)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(alive(todos), eq(todos.id, id), eq(todos.accountId, accountId)))
      .returning();
    return row ?? null;
  }

  /**
   * Удаляет запись; подзадачи уходят каскадом по карте владения.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns `true`, если удалена.
   */
  public async delete(id: string, accountId: string): Promise<boolean> {
    return this._db.transaction(async (transaction) => {
      const removed = await deleteCascade(
        transaction,
        todos,
        and(alive(todos), eq(todos.id, id), eq(todos.accountId, accountId)),
      );
      return removed > 0;
    });
  }

  /**
   * Переставляет записи в заданном порядке (одним запросом, как у остальных списков).
   * @param accountId Идентификатор аккаунта.
   * @param orderedIds Идентификаторы в новом порядке.
   * @returns Промис завершения.
   */
  public async reorder(accountId: string, orderedIds: string[]): Promise<void> {
    if (orderedIds.length === 0) {
      return;
    }
    const tuples = orderedIds.map((id, index) => sql`(${id}, ${index})`);
    await this._db.execute(sql`
      UPDATE ${todos} AS t SET position = v.pos::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, pos)
      WHERE t.id = v.id AND t.account_id = ${accountId}
    `);
  }

  /**
   * События справочника.
   * @param accountId Идентификатор аккаунта.
   * @param includeHappened Включать ли состоявшиеся.
   * @returns События владельца.
   */
  public async listEvents(accountId: string, includeHappened: boolean): Promise<TodoEventFull[]> {
    return this._db
      .select()
      .from(todoEvents)
      .where(
        and(
          alive(todoEvents),
          eq(todoEvents.accountId, accountId),
          isNull(todoEvents.archivedAt),
          includeHappened ? undefined : isNull(todoEvents.happenedAt),
        ),
      )
      .orderBy(asc(todoEvents.expectedOn), asc(todoEvents.createdAt), asc(todoEvents.id));
  }

  /**
   * Событие по идентификатору с проверкой владения.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Событие или null.
   */
  public async findOwnedEvent(id: string, accountId: string): Promise<TodoEventFull | null> {
    const [row] = await this._db
      .select()
      .from(todoEvents)
      .where(and(alive(todoEvents), eq(todoEvents.id, id), eq(todoEvents.accountId, accountId)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Создаёт событие.
   * @param data Данные создания.
   * @returns Созданное событие.
   * @throws {Error} Если insert не вернул строку.
   */
  public async createEvent(data: TodoEventCreateData): Promise<TodoEventFull> {
    const rows = await this._db
      .insert(todoEvents)
      .values({
        id: generateId(),
        accountId: data.accountId,
        title: data.title,
        expectedOn: data.expectedOn ?? null,
        happenedAt: null,
        archivedAt: null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('todo_events: create не вернул строку.');
    }
    return row;
  }

  /**
   * Обновляет событие.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Изменяемые поля.
   * @returns Обновлённое событие или null.
   */
  public async updateEvent(
    id: string,
    accountId: string,
    patch: TodoEventUpdateData,
  ): Promise<TodoEventFull | null> {
    const [row] = await this._db
      .update(todoEvents)
      .set(patch)
      .where(and(alive(todoEvents), eq(todoEvents.id, id), eq(todoEvents.accountId, accountId)))
      .returning();
    return row ?? null;
  }

  /**
   * Отмечает событие состоявшимся или снимает отметку.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param happened `true` — состоялось.
   * @returns Обновлённое событие или null.
   */
  public async setEventHappened(
    id: string,
    accountId: string,
    happened: boolean,
  ): Promise<TodoEventFull | null> {
    const [row] = await this._db
      .update(todoEvents)
      .set({ happenedAt: happened ? new Date() : null })
      .where(and(alive(todoEvents), eq(todoEvents.id, id), eq(todoEvents.accountId, accountId)))
      .returning();
    return row ?? null;
  }

  /**
   * Удаляет событие.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns `true`, если удалено.
   */
  public async deleteEvent(id: string, accountId: string): Promise<boolean> {
    return this._db.transaction(async (transaction) => {
      const removed = await deleteCascade(
        transaction,
        todoEvents,
        and(alive(todoEvents), eq(todoEvents.id, id), eq(todoEvents.accountId, accountId)),
      );
      return removed > 0;
    });
  }

  /**
   * Снимает ожидание у записей, ждавших событие.
   * @param accountId Идентификатор аккаунта.
   * @param eventId Идентификатор события.
   * @returns Сколько записей освободилось.
   */
  public async releaseWaiting(accountId: string, eventId: string): Promise<number> {
    const rows = await this._db
      .update(todos)
      .set({ waitsForEventId: null })
      .where(
        and(alive(todos), eq(todos.accountId, accountId), eq(todos.waitsForEventId, eventId)),
      )
      .returning({ id: todos.id });
    return rows.length;
  }
}
