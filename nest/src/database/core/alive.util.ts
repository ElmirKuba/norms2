import { and, getTableColumns, isNotNull, isNull } from 'drizzle-orm';
import { isParanoid } from '../schemas/define-table.helper';
import type { SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * Что читаем: живое (по умолчанию) или удалённое
 * ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 *
 * **`deleted: true` — служебная способность**: ретеншн, диагностика, ручное восстановление после
 * чужой ошибки. В порты она не выносится и домену недоступна: продуктовой корзины у нас нет, для
 * бизнес-логики любое удаление безвозвратно.
 */
export interface ReadScope {
  /** `false` (умолчание) — живые строки, `true` — удалённые. */
  deleted?: boolean;
}

/**
 * Колонка `deleted_at` таблицы или `undefined`, если её нет (чужая/служебная таблица).
 * @param table Таблица.
 * @returns Колонка метки удаления.
 */
function deletedAtOf(table: PgTable): PgColumn | undefined {
  const columns: Record<string, PgColumn> = getTableColumns(table);
  return columns['deletedAt'];
}

/**
 * Условие живости строки — то, что обязан подставить **любой** запрос к таблице.
 *
 * **У жёсткой таблицы возвращает `undefined`, а не «ложное» условие** — там `deleted_at` есть
 * физически, но смысла не несёт, и фильтровать по нему было бы враньём. `undefined` в
 * `and(...)` Drizzle просто выбрасывает, поэтому вызов безопасно ставить в любой запрос, ничего
 * не зная о режиме таблицы. Ради этого свойства режим и живёт на самой таблице: чужой
 * репозиторий, который её джойнит, обязан подставить условие, не разбираясь в её устройстве
 * (ровно на этом сгорел `014459e`).
 *
 * @param table Таблица.
 * @param scope Что читаем: живое или удалённое.
 * @returns Условие или `undefined`, если фильтровать нечего.
 */
export function alive(table: PgTable, scope: ReadScope = {}): SQL | undefined {
  if (!isParanoid(table)) {
    return undefined;
  }
  const column = deletedAtOf(table);
  if (column === undefined) {
    return undefined;
  }
  return scope.deleted === true ? isNotNull(column) : isNull(column);
}

/**
 * Собирает `where` с условием живости — короткая форма для репозиториев.
 * @param table Таблица.
 * @param conditions Прикладные условия (undefined пропускаются).
 * @returns Условие для `.where()`.
 */
export function whereAlive(
  table: PgTable,
  ...conditions: (SQL | undefined)[]
): SQL | undefined {
  return and(alive(table), ...conditions);
}
