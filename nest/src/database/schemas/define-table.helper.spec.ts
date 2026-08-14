import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schemas from './index';
import { isParanoid } from './define-table.helper';

/** Таблицы, которые удаляются физически (ADR-0068). Всё остальное — мягко. */
const HARD_TABLES = [
  'secret_qa',
  'invite_codes',
  'account_roles',
  'telegram_links',
  'telegram_updates',
  'tasks',
  // 2.9.3·35: под обещание в политике — «идентификатор чата не остаётся». Спрятанная строка
  // остаётся, поэтому мягкий режим тут сделал бы текст неправдой.
  'telegram_requests',
];

/**
 * Инварианты режима удаления (2.9.3·16, [ADR-0068]).
 *
 * Стерегут три вещи, каждая из которых ломается молча:
 * 1. **`deleted_at` есть у КАЖДОЙ таблицы** — способность принадлежит слою 5, а не избранным
 *    фичам; забытая колонка вскроется не тестом, а потерянными данными;
 * 2. **умолчание — мягкое.** Новая таблица, заведённая без единой мысли о режиме, не должна
 *    стирать данные человека;
 * 3. **жёсткие таблицы — ровно те, что разобраны в ADR.** Список короткий, и каждое добавление
 *    в него обязано быть осознанным: это единственные места, где данные исчезают. Тест уже
 *    отработал по назначению: перевод `telegram_requests` в жёсткий режим (·35) он поймал сразу
 *    и потребовал объяснить — так и задумано, список не растёт молча.
 */
describe('режим удаления таблиц (ADR-0068)', () => {
  /** Все таблицы из барреля схем — как их видит drizzle. */
  const tables = Object.values(schemas).filter((value): value is PgTable => is(value, PgTable));

  it('таблиц много и они читаются из барреля', () => {
    expect(tables.length).toBeGreaterThanOrEqual(33);
  });

  it('deleted_at есть у каждой таблицы', () => {
    const without = tables
      .filter((table) => !('deletedAt' in getTableColumns(table)))
      .map((table) => getTableName(table));

    expect(without).toEqual([]);
  });

  it('жёсткие — ровно перечисленные, остальные мягкие', () => {
    const hard = tables.filter((table) => !isParanoid(table)).map((table) => getTableName(table));

    expect(hard.sort()).toEqual([...HARD_TABLES].sort());
  });
});
