import { and, eq, getTableColumns, getTableName, inArray, isNotNull, isNull } from 'drizzle-orm';
import { isParanoid } from '../schemas/define-table.helper';
import { ownedChildren } from './deletion-graph';
import type { SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleExecutor } from '../client/database.constants';

/** Как удаляем ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)). */
export interface DeleteOptions {
  /**
   * Физически стереть строку, даже если таблица мягкая.
   *
   * **Названное исключение, а не лазейка:** сброс витрины примеров, дедуп-отметки, погашенные
   * коды. Пишется параметром — значит видно в коде и в ревью.
   */
  force?: boolean;
  /**
   * Метка удаления. Одна на весь каскад: без неё ручное восстановление неотличимо от «этот
   * замер человек удалил сам ещё в марте». Задаётся движком, наружу нужна только рекурсии.
   */
  at?: Date;
}

/**
 * Ядро удаления слоя 5 — **свой каскад вместо каскада базы**.
 *
 * `ON DELETE CASCADE` снят со всех связей осознанно: он срабатывает только на физическом
 * `DELETE`, ничего не знает о режимах таблиц и однажды унёс бы мягко удаляемых внуков молча.
 * База осталась копилкой и сторожем (FK на месте, `no action`), а решение «кого и как» —
 * здесь.
 *
 * **Обход снизу вверх.** Сначала спускаемся до листьев, разрешаем каждый узел **по его
 * собственному режиму**, и лишь потом трогаем родителя. Поэтому оба смешанных случая честны:
 * у мягкого родителя жёсткий ребёнок стирается физически, а у жёсткого родителя мягкий ребёнок
 * **получает метку**, а не `DELETE`.
 *
 * Вызывается внутри транзакции: половина каскада хуже, чем ни одного.
 */
export async function deleteCascade(
  executor: DrizzleExecutor,
  table: PgTable,
  where: SQL,
  options: DeleteOptions = {},
): Promise<number> {
  const at = options.at ?? new Date();
  const ids = await selectIds(executor, table, where);
  if (ids.length === 0) {
    return 0;
  }

  for (const edge of ownedChildren(table)) {
    // Самоссылка (подцели) — та же таблица: рекурсия по ней же, глубину ограничивает конечность
    // дерева, а не счётчик.
    await deleteCascade(
      executor,
      edge.child,
      inArray(edge.column, ids),
      options.force === true ? { at, force: true } : { at },
    );
  }

  const soft = isParanoid(table) && options.force !== true;
  const primary = primaryKeyOf(table);
  if (soft) {
    const deletedAt = deletedAtOf(table);
    await runUpdate(executor, table, { deletedAt: at }, and(inArray(primary, ids), isNull(deletedAt)));
    return ids.length;
  }
  await runDelete(executor, table, inArray(primary, ids));
  return ids.length;
}

/**
 * Снимает метку удаления с поддерева — **ручное восстановление, не продуктовая корзина**.
 *
 * Возвращает только тех детей, что ушли **этим же** удалением: сравнение идёт по метке времени,
 * одной на весь каскад. Иначе восстановление родителя вернуло бы и то, что человек удалил
 * отдельно и раньше.
 *
 * Физически стёртые дети (жёсткие таблицы) не возвращаются ничем — так и задумано: их удаление
 * было настоящим.
 */
export async function restoreCascade(
  executor: DrizzleExecutor,
  table: PgTable,
  where: SQL,
): Promise<number> {
  if (!isParanoid(table)) {
    return 0;
  }
  const deletedAt = deletedAtOf(table);
  const rows = await selectRows(executor, table, and(where, isNotNull(deletedAt)));
  if (rows.length === 0) {
    return 0;
  }

  const primary = primaryKeyOf(table);
  const ids = rows.map((row) => row.id);
  await runUpdate(executor, table, { deletedAt: null }, inArray(primary, ids));

  for (const edge of ownedChildren(table)) {
    const childDeletedAt = deletedAtOf(edge.child);
    for (const row of rows) {
      if (row.deletedAt === null) {
        continue;
      }
      await restoreCascade(
        executor,
        edge.child,
        and(eq(edge.column, row.id), eq(childDeletedAt, row.deletedAt)) as SQL,
      );
    }
  }
  return ids.length;
}

/**
 * PK-колонка таблицы. У всех наших таблиц он один (`id`, у журнала апдейтов — `update_id`).
 * @param table Таблица.
 * @returns Колонка первичного ключа.
 */
function primaryKeyOf(table: PgTable): PgColumn {
  const columns: Record<string, PgColumn> = getTableColumns(table);
  const primary = Object.values(columns).find((column) => column.primary);
  if (primary === undefined) {
    throw new Error(`У таблицы ${tableName(table)} нет первичного ключа — каскад невозможен`);
  }
  return primary;
}

/**
 * Имя таблицы для сообщений об ошибке.
 * @param table Таблица.
 * @returns Имя.
 */
function tableName(table: PgTable): string {
  return getTableName(table);
}

/**
 * Колонка метки удаления.
 * @param table Таблица.
 * @returns Колонка `deleted_at`.
 */
function deletedAtOf(table: PgTable): PgColumn {
  const columns: Record<string, PgColumn> = getTableColumns(table);
  const column = columns['deletedAt'];
  if (column === undefined) {
    throw new Error(`У таблицы ${tableName(table)} нет deleted_at`);
  }
  return column;
}

// Ниже — единственное место в проекте, где запросы строятся по «любой таблице». Drizzle
// типизирует их от конкретной таблицы, а здесь она приходит значением, поэтому три узкие
// обёртки с приведением. Дальше этого файла приведения не уходят.

/** Минимальная форма исполнителя для динамических запросов. */
interface DynamicExecutor {
  select: (fields: Record<string, PgColumn>) => {
    from: (table: PgTable) => { where: (condition: SQL | undefined) => Promise<unknown[]> };
  };
  update: (table: PgTable) => {
    set: (values: Record<string, unknown>) => { where: (condition: SQL | undefined) => Promise<unknown> };
  };
  delete: (table: PgTable) => { where: (condition: SQL | undefined) => Promise<unknown> };
}

/**
 * Идентификаторы строк, попавших под условие.
 * @param executor Исполнитель.
 * @param table Таблица.
 * @param where Условие.
 * @returns Список PK.
 */
async function selectIds(executor: DrizzleExecutor, table: PgTable, where: SQL): Promise<string[]> {
  const rows = (await (executor as unknown as DynamicExecutor)
    .select({ id: primaryKeyOf(table) })
    .from(table)
    .where(where)) as { id: string }[];
  return rows.map((row) => row.id);
}

/**
 * Строки с их меткой удаления — нужны восстановлению, чтобы сравнить метку у детей.
 * @param executor Исполнитель.
 * @param table Таблица.
 * @param where Условие.
 * @returns PK и метка удаления.
 */
async function selectRows(
  executor: DrizzleExecutor,
  table: PgTable,
  where: SQL | undefined,
): Promise<{ id: string; deletedAt: Date | null }[]> {
  return (await (executor as unknown as DynamicExecutor)
    .select({ id: primaryKeyOf(table), deletedAt: deletedAtOf(table) })
    .from(table)
    .where(where)) as { id: string; deletedAt: Date | null }[];
}

/**
 * Обновление по динамической таблице.
 * @param executor Исполнитель.
 * @param table Таблица.
 * @param values Что ставим.
 * @param where Условие.
 * @returns Промис завершения.
 */
async function runUpdate(
  executor: DrizzleExecutor,
  table: PgTable,
  values: Record<string, unknown>,
  where: SQL | undefined,
): Promise<void> {
  await (executor as unknown as DynamicExecutor).update(table).set(values).where(where);
}

/**
 * Физическое удаление по динамической таблице.
 * @param executor Исполнитель.
 * @param table Таблица.
 * @param where Условие.
 * @returns Промис завершения.
 */
async function runDelete(
  executor: DrizzleExecutor,
  table: PgTable,
  where: SQL | undefined,
): Promise<void> {
  await (executor as unknown as DynamicExecutor).delete(table).where(where);
}
