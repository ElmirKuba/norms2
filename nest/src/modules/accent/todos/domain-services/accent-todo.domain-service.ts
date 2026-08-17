import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_TODO_REPOSITORY } from '../adapters/accent-todo-repository.port';
import type {
  AccentTodoRepositoryPort,
  TodoCreateData,
  TodoEventCreateData,
  TodoEventUpdateData,
  TodoUpdateData,
} from '../adapters/accent-todo-repository.port';
import { TodoNotFoundError } from '../../../../shared/errors/todo-not-found.error';
import { TodoEventNotFoundError } from '../../../../shared/errors/todo-event-not-found.error';
import { TodoMaxDepthReachedError } from '../../../../shared/errors/todo-max-depth-reached.error';
import { ValidationError } from '../../../../shared/errors/validation.error';
import type { TodoFull, TodoKind } from '../interfaces/todo-full.interface';
import type { TodoEventFull } from '../interfaces/todo-event-full.interface';

/**
 * Предел вложенности подзадач.
 *
 * Не «на всякий случай»: подзадача — полноценная запись, значит дерево может расти бесконечно,
 * а бесконечное дерево нечем показать на экране телефона. Три уровня покрывают живые данные
 * (в `KubaPersonal/tasks.md` встречается 2–3) и оставляют запас.
 */
const MAX_DEPTH = 3;

/**
 * Доменные правила списков дел (2.10, блок C).
 *
 * **Главное правило здесь — то, чего в нём нет:** единственное обязательное поле — заголовок.
 * Всякая дополнительная проверка на входе повышает порог записи, а продукт заводится ровно
 * потому, что прежний порог оказался непроходимым (разовых задач за два с половиной месяца —
 * ноль).
 */
@Injectable()
export class AccentTodoDomainService {
  /**
   * @param _repository Порт хранилища дел и событий.
   */
  public constructor(
    @Inject(ACCENT_TODO_REPOSITORY) private readonly _repository: AccentTodoRepositoryPort,
  ) {}

  /**
   * Список записей одного вида вместе с подзадачами.
   * @param accountId Идентификатор аккаунта.
   * @param kind Вид записи.
   * @param archived `true` — архив.
   * @returns Корневые записи и их подзадачи одним куском.
   */
  public async list(
    accountId: string,
    kind: TodoKind | null,
    archived: boolean,
  ): Promise<{ roots: TodoFull[]; children: TodoFull[] }> {
    const roots = await this._repository.listByKind(accountId, kind, archived);
    const children = await this._repository.listChildren(
      accountId,
      roots.map((row) => row.id),
    );
    return { roots, children };
  }

  /**
   * Создаёт запись.
   * @param data Данные создания (заголовок обязателен, остальное — по желанию).
   * @returns Созданная запись.
   * @throws {ValidationError} Пустой заголовок, слишком глубокая вложенность, чужое событие.
   * @throws {TodoNotFoundError} Родитель не найден.
   */
  public async create(data: TodoCreateData): Promise<TodoFull> {
    const title = data.title.trim();
    if (title === '') {
      throw new ValidationError('Заголовок не может быть пустым.');
    }
    if (data.parentId != null) {
      await this._assertDepthOk(data.parentId, data.accountId);
    }
    await this._assertEventOwned(data.waitsForEventId ?? null, data.accountId);
    return this._repository.create({ ...data, title });
  }

  /**
   * Обновляет запись.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Изменяемые поля.
   * @returns Обновлённая запись.
   * @throws {TodoNotFoundError} Записи нет или она чужая.
   * @throws {ValidationError} Пустой заголовок или чужое событие.
   */
  public async update(id: string, accountId: string, patch: TodoUpdateData): Promise<TodoFull> {
    if (patch.title !== undefined && patch.title.trim() === '') {
      throw new ValidationError('Заголовок не может быть пустым.');
    }
    if (patch.waitsForEventId !== undefined) {
      await this._assertEventOwned(patch.waitsForEventId, accountId);
    }
    const clean: TodoUpdateData = { ...patch };
    if (clean.title !== undefined) {
      clean.title = clean.title.trim();
    }
    const row = await this._repository.update(id, accountId, clean);
    if (!row) {
      throw new TodoNotFoundError('Запись не найдена.');
    }
    return row;
  }

  /**
   * Ставит или снимает отметку выполнения.
   *
   * **Родитель не закрывается сам** при закрытии всех подзадач: решение об этом отложено
   * (открытый вопрос черновика), а автоматика, закрывающая дела за человека, — не та вещь,
   * которую стоит вводить по умолчанию.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param done `true` — выполнена.
   * @returns Обновлённая запись.
   * @throws {TodoNotFoundError} Записи нет или она чужая.
   */
  public async setDone(id: string, accountId: string, done: boolean): Promise<TodoFull> {
    const row = await this._repository.setDone(id, accountId, done);
    if (!row) {
      throw new TodoNotFoundError('Запись не найдена.');
    }
    return row;
  }

  /**
   * Отправляет в архив или возвращает.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param archived `true` — в архив.
   * @returns Обновлённая запись.
   * @throws {TodoNotFoundError} Записи нет или она чужая.
   */
  public async setArchived(id: string, accountId: string, archived: boolean): Promise<TodoFull> {
    const row = await this._repository.setArchived(id, accountId, archived);
    if (!row) {
      throw new TodoNotFoundError('Запись не найдена.');
    }
    return row;
  }

  /**
   * Удаляет запись вместе с подзадачами.
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Промис завершения.
   * @throws {TodoNotFoundError} Записи нет или она чужая.
   */
  public async delete(id: string, accountId: string): Promise<void> {
    const removed = await this._repository.delete(id, accountId);
    if (!removed) {
      throw new TodoNotFoundError('Запись не найдена.');
    }
  }

  /**
   * Переставляет записи.
   * @param accountId Идентификатор аккаунта.
   * @param orderedIds Идентификаторы в новом порядке.
   * @returns Промис завершения.
   */
  public async reorder(accountId: string, orderedIds: string[]): Promise<void> {
    await this._repository.reorder(accountId, orderedIds);
  }

  /**
   * События справочника.
   * @param accountId Идентификатор аккаунта.
   * @param includeHappened Включать ли состоявшиеся.
   * @returns События владельца.
   */
  public async listEvents(accountId: string, includeHappened: boolean): Promise<TodoEventFull[]> {
    return this._repository.listEvents(accountId, includeHappened);
  }

  /**
   * Создаёт событие справочника.
   * @param data Данные создания.
   * @returns Созданное событие.
   * @throws {ValidationError} Пустое название.
   */
  public async createEvent(data: TodoEventCreateData): Promise<TodoEventFull> {
    const title = data.title.trim();
    if (title === '') {
      throw new ValidationError('Название события не может быть пустым.');
    }
    return this._repository.createEvent({ ...data, title });
  }

  /**
   * Обновляет событие.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Изменяемые поля.
   * @returns Обновлённое событие.
   * @throws {TodoNotFoundError} События нет или оно чужое.
   * @throws {ValidationError} Пустое название.
   */
  public async updateEvent(
    id: string,
    accountId: string,
    patch: TodoEventUpdateData,
  ): Promise<TodoEventFull> {
    if (patch.title !== undefined && patch.title.trim() === '') {
      throw new ValidationError('Название события не может быть пустым.');
    }
    const clean: TodoEventUpdateData = { ...patch };
    if (clean.title !== undefined) {
      clean.title = clean.title.trim();
    }
    const row = await this._repository.updateEvent(id, accountId, clean);
    if (!row) {
      throw new TodoEventNotFoundError('Событие не найдено.');
    }
    return row;
  }

  /**
   * Отмечает событие состоявшимся — и **освобождает все ждавшие его дела разом**.
   *
   * Это и есть смысл справочника: сварщик приехал один раз, а ждали его три дела. Без снятия
   * ожидания они остались бы висеть в ожидании того, что уже случилось.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param happened `true` — состоялось.
   * @returns Событие и сколько дел освободилось.
   * @throws {TodoNotFoundError} События нет или оно чужое.
   */
  public async setEventHappened(
    id: string,
    accountId: string,
    happened: boolean,
  ): Promise<{ event: TodoEventFull; released: number }> {
    const event = await this._repository.setEventHappened(id, accountId, happened);
    if (!event) {
      throw new TodoEventNotFoundError('Событие не найдено.');
    }
    const released = happened ? await this._repository.releaseWaiting(accountId, id) : 0;
    return { event, released };
  }

  /**
   * Удаляет событие, предварительно сняв ожидание у дел.
   *
   * Порядок важен: удалить событие и оставить в делах ссылку на него — это ровно тот
   * ярлык-призрак, из-за которого в 2.9.3 заводили правило проверять живость мягких ссылок.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Промис завершения.
   * @throws {TodoNotFoundError} События нет или оно чужое.
   */
  public async deleteEvent(id: string, accountId: string): Promise<void> {
    await this._repository.releaseWaiting(accountId, id);
    const removed = await this._repository.deleteEvent(id, accountId);
    if (!removed) {
      throw new TodoEventNotFoundError('Событие не найдено.');
    }
  }

  /**
   * Проверяет, что глубина вложенности не превышена.
   * @param parentId Идентификатор родителя.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Промис завершения.
   * @throws {TodoNotFoundError} Родитель не найден.
   * @throws {ValidationError} Глубже допустимого.
   */
  private async _assertDepthOk(parentId: string, accountId: string): Promise<void> {
    let depth = 0;
    let cursor: string | null = parentId;
    while (cursor !== null) {
      const node: TodoFull | null = await this._repository.findOwned(cursor, accountId);
      if (!node) {
        throw new TodoNotFoundError('Родительская запись не найдена.');
      }
      depth += 1;
      if (depth >= MAX_DEPTH) {
        throw new TodoMaxDepthReachedError(`Глубже ${String(MAX_DEPTH)} уровней вкладывать нельзя.`);
      }
      cursor = node.parentId;
    }
  }

  /**
   * Проверяет, что событие существует и принадлежит владельцу.
   * @param eventId Идентификатор события или null.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Промис завершения.
   * @throws {ValidationError} Событие чужое или не существует.
   */
  private async _assertEventOwned(eventId: string | null, accountId: string): Promise<void> {
    if (eventId == null) {
      return;
    }
    const event = await this._repository.findOwnedEvent(eventId, accountId);
    if (!event) {
      throw new TodoEventNotFoundError('Событие не найдено.');
    }
  }
}
