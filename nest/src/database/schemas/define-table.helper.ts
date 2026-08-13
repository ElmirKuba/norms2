import { pgTable } from 'drizzle-orm/pg-core';
import { deletedAtColumn } from './_shared';
import type { PgColumnBuilderBase, PgTable, PgTableExtraConfigValue } from 'drizzle-orm/pg-core';
import type { BuildExtraConfigColumns } from 'drizzle-orm';

/** Карта колонок: на каждый ключ строки-контракта TRow — билдер колонки. */
export type ColumnMapFromRow<TRow> = Record<keyof TRow, PgColumnBuilderBase>;

/** Запрет лишних ключей: ключ колонок, которого нет в TRow, обязан быть never → ошибка. */
type NoExtraKeys<TColumns, TRow> = Record<Exclude<keyof TColumns, keyof TRow>, never>;

/**
 * Режим удаления таблицы ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 *
 * **`paranoid: true` (по умолчанию)** — `delete` проставляет `deleted_at`, чтения отдают только
 * живые строки. **`paranoid: false`** — `delete` физически стирает, а чтения **не добавляют
 * никакого условия** по `deleted_at`: колонка у таблицы есть, но смысла не несёт.
 */
export interface TableOptions {
  /** Мягкое удаление вместо физического. По умолчанию `true`. */
  paranoid?: boolean;
}

/**
 * Реестр режимов: таблица → мягко ли удаляем.
 *
 * **Ключ — сама таблица, а не её имя,** и это не мелочь: режим спрашивают в том числе чужие
 * репозитории, которые джойнят таблицу и обязаны подставить условие живости, ничего про неё не
 * зная (ровно на этом сгорел `014459e`). Имея объект таблицы, ответ доступен всегда.
 */
const PARANOID_MODES = new WeakMap<PgTable, boolean>();

/**
 * Мягко ли удаляется таблица.
 * @param table Таблица Drizzle.
 * @returns `true` — `deleted_at`, `false` — физическое удаление.
 */
export function isParanoid(table: PgTable): boolean {
  // Незарегистрированная таблица — служебная (журнал drizzle-kit) или чужая; считаем её жёсткой:
  // молча фильтровать по колонке, которой может не быть, опаснее.
  return PARANOID_MODES.get(table) ?? false;
}

/**
 * Обёртка над pgTable с generic-контролем: <TRow> требует, чтобы набор колонок
 * ТОЧНО совпадал с ключами строки-контракта (нет недостающих и нет лишних),
 * при этом СОХРАНЯЯ точную типизацию колонок Drizzle ($inferSelect/$inferInsert).
 * Каррирование (<TRow>()(...)) нужно, чтобы TRow задавать явно, а имя/колонки —
 * выводить. Третий аргумент — наш конфиг индексов/CHECK, четвёртый — режим удаления.
 *
 * **`deleted_at` добавляется здесь, а не в схемах** ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 * Причина не в экономии строк: колонка, дописанная в схему руками, обязана появиться и в
 * доменном интерфейсе `*Full` — этого требует проверка «колонки 1:1 с контрактом». То есть
 * `deletedAt` протёк бы в домен на уровне типов, а он про хранение знать не должен. Добавляя
 * колонку **после** проверки, мы даём способность слою 5 и оставляем домен чистым.
 */
export function defineTableWithSchema<TRow>() {
  return <
    TName extends string,
    TColumns extends ColumnMapFromRow<TRow> & NoExtraKeys<TColumns, TRow>,
  >(
    name: TName,
    columns: TColumns,
    extraConfig?: (self: BuildExtraConfigColumns<TName, TColumns, 'pg'>) => PgTableExtraConfigValue[],
    options?: TableOptions,
  ) => {
    const table = pgTable(
      name,
      { ...columns, deletedAt: deletedAtColumn() },
      // Конфиг индексов написан против объявленных колонок; `deleted_at` их набор расширяет, но
      // не сужает, поэтому сужение типа здесь безопасно и остаётся внутри хелпера.
      extraConfig as ((self: Record<string, unknown>) => PgTableExtraConfigValue[]) | undefined,
    );
    PARANOID_MODES.set(table as unknown as PgTable, options?.paranoid ?? true);
    return table;
  };
}
