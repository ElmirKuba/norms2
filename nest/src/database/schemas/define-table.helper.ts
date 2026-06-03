import { pgTable } from 'drizzle-orm/pg-core';
import type { PgColumnBuilderBase, PgTableExtraConfigValue } from 'drizzle-orm/pg-core';
import type { BuildExtraConfigColumns } from 'drizzle-orm';

/** Карта колонок: на каждый ключ строки-контракта TRow — билдер колонки. */
export type ColumnMapFromRow<TRow> = Record<keyof TRow, PgColumnBuilderBase>;

/** Запрет лишних ключей: ключ колонок, которого нет в TRow, обязан быть never → ошибка. */
type NoExtraKeys<TColumns, TRow> = Record<Exclude<keyof TColumns, keyof TRow>, never>;

/**
 * Обёртка над pgTable с generic-контролем: <TRow> требует, чтобы набор колонок
 * ТОЧНО совпадал с ключами строки-контракта (нет недостающих и нет лишних),
 * при этом СОХРАНЯЯ точную типизацию колонок Drizzle ($inferSelect/$inferInsert).
 * Каррирование (<TRow>()(...)) нужно, чтобы TRow задавать явно, а имя/колонки —
 * выводить. Третий аргумент — наш конфиг индексов/CHECK.
 */
export function defineTableWithSchema<TRow>() {
  return <
    TName extends string,
    TColumns extends ColumnMapFromRow<TRow> & NoExtraKeys<TColumns, TRow>,
  >(
    name: TName,
    columns: TColumns,
    extraConfig?: (self: BuildExtraConfigColumns<TName, TColumns, 'pg'>) => PgTableExtraConfigValue[],
  ) => pgTable(name, columns, extraConfig);
}
