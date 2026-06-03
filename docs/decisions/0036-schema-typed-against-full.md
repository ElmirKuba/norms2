# ADR-0036: Схемы Drizzle типобезопасны против контракта строки (`defineTableWithSchema`)

- Статус: accepted
- Дата: 2026-06-03
- Теги: [architecture] [backend] [db] [conventions]
- Связано/уточняет: [ADR-0033](./0033-type-hierarchy-convention.md) (иерархия типов), [ADR-0034](./0034-feature-first-layout.md) (раскладка).
- Идея: наработка Elmir из `~/coding/kuba-game` (`defineTableWithSchema`), переосмыслена под Postgres + сохранение вывода типов.

## Контекст

Голый `pgTable('accounts', { ... })` **не контролирует** набор колонок: можно забыть `version`, опечатать ключ или добавить лишнюю колонку — TypeScript промолчит. Хочется, чтобы схема была **сверена компилятором** с доменным контрактом строки (`XxxFull`, ADR-0033: «Full ≈ строка БД»).

В исходном helper (`columns: ColumnMapFromInterface<T>`) есть скрытая цена: Drizzle **теряет точные типы колонок** → ломается `$inferSelect`/`$inferInsert`, которые нам нужны для маппинга `row → Full`.

## Решение

Обёртка **`defineTableWithSchema<TRow>()(name, columns, extraConfig?)`** (`database/schemas/define-table.helper.ts`):
- generic `TRow` (= `XxxFull`) задаёт **контракт строки**; набор ключей `columns` обязан **точно** совпасть с ключами `TRow` — нет недостающих (mapped-тип) и нет лишних (`NoExtraKeys` → лишний ключ выводится в `never` → ошибка компиляции);
- **сохраняет вывод типов Drizzle** (`$inferSelect` точный) — за счёт каррирования `<TRow>()(...)`: TypeScript **не умеет частичный вывод дженериков**, поэтому `TRow` задаём явно первым вызовом, а имя/колонки выводятся вторым;
- третий аргумент — наш конфиг индексов/CHECK (`(table) => [...]`).
- **Чисто compile-time**: на сгенерированный SQL не влияет (миграция идентична голому `pgTable`).

**Контракты `XxxFull`** живут в `modules/<area>/interfaces/` (ADR-0033, feature-first); схема в `database/schemas/` импортирует их **type-only**.

### Межслойная зависимость (сознательно)
`database/schemas → modules/<area>/interfaces` — это зависимость инфры от доменного **контракта** (тип, без логики/ORM), в **правильную** сторону clean-arch (инфра подчиняется домену, не наоборот). Допустима; обратной (`modules → database`) нет.

## Альтернативы
- **Голый `pgTable`** — отвергнут: ноль контроля набора колонок.
- **Исходный helper без каррирования** (один вызов) — отвергнут: теряет вывод типов Drizzle (`$inferSelect`).
- **Нативный `pgTable` + отдельный type-assert** — рабочий, но размазывает проверку на две конструкции; обёртка цельнее.

## Последствия
- Все 6 схем фазы 1 переведены на `defineTableWithSchema<XxxFull>()`.
- При добавлении таблицы: сначала контракт `XxxFull` в `modules/<area>/interfaces`, затем схема через helper.
- Nullable-колонки в `Full` — как `| null` (ключ присутствует), не опциональные ключи.
