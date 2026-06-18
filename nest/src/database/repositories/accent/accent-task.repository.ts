import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { tasks } from '../../schemas/tasks.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentTaskRepositoryPort,
  TaskCreateData,
  TaskUpdateData,
} from '../../../modules/accent/habits/adapters/accent-task-repository.port';
import type { TaskFull } from '../../../modules/accent/habits/interfaces/task-full.interface';

/**
 * Drizzle-реализация порта задач дня (единственное место с ORM). Строка `tasks`
 * структурно совпадает с `TaskFull` (колонки 1:1) → маппинг прямой. Всё скоупится по
 * `account_id`. Биндится на `ACCENT_TASK_REPOSITORY`.
 */
@Injectable()
export class AccentTaskRepository implements AccentTaskRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Задачи аккаунта на день (priority desc, затем created_at asc).
   * @param accountId Идентификатор аккаунта.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns Задачи дня владельца.
   */
  public async listByAccountOn(accountId: string, occurredOn: string): Promise<TaskFull[]> {
    return this._db
      .select()
      .from(tasks)
      .where(and(eq(tasks.accountId, accountId), eq(tasks.occurredOn, occurredOn)))
      .orderBy(desc(tasks.priority), asc(tasks.createdAt));
  }

  /**
   * Находит задачу по id с проверкой владения.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  public async findOwned(id: string, accountId: string): Promise<TaskFull | null> {
    const rows = await this._db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.accountId, accountId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт задачу (id — `generateId()`).
   * @param data Данные создания.
   * @returns Созданная задача.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: TaskCreateData): Promise<TaskFull> {
    const rows = await this._db.insert(tasks).values(this._toRow(data)).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('tasks: create не вернул строку.');
    }
    return row;
  }

  /**
   * Массовая вставка задач (материализация); ON CONFLICT `(template_id, occurred_on)` DO NOTHING.
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  public async createMany(items: readonly TaskCreateData[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }
    const rows = await this._db
      .insert(tasks)
      .values(items.map((data) => this._toRow(data)))
      .onConflictDoNothing()
      .returning({ id: tasks.id });
    return rows.length;
  }

  /**
   * Обновляет задачу владельца (статус/выполнение).
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  public async update(
    id: string,
    accountId: string,
    patch: TaskUpdateData,
  ): Promise<TaskFull | null> {
    const rows = await this._db
      .update(tasks)
      .set(patch)
      .where(and(eq(tasks.id, id), eq(tasks.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Готовит строку для вставки (id + дефолты).
   * @param data Данные создания.
   * @returns Объект значений вставки.
   */
  private _toRow(data: TaskCreateData): typeof tasks.$inferInsert {
    return {
      id: generateId(),
      accountId: data.accountId,
      title: data.title,
      occurredOn: data.occurredOn,
      kind: data.kind,
      templateId: data.templateId ?? null,
      goalId: data.goalId ?? null,
      targetValue: data.targetValue ?? null,
      doneValue: data.doneValue ?? null,
      status: data.status ?? 'pending',
      priority: data.priority ?? 0,
      category: data.category ?? null,
      deadline: data.deadline ?? null,
      postponedFromTaskId: data.postponedFromTaskId ?? null,
      completedAt: data.completedAt ?? null,
      skipReason: data.skipReason ?? null,
    };
  }
}
