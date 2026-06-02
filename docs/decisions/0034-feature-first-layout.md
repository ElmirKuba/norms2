# ADR-0034: Раскладка кода — feature-first + вынесенный `database/`

- Статус: accepted
- Дата: 2026-06-02
- Теги: [architecture] [backend] [conventions]
- Уточняет: [ADR-0030](./0030-stack-revision-drizzle-5layer-npm.md) (5-слойка остаётся; меняется только проекция слоёв на папки).

## Контекст

ADR-0030 ввёл 5-слойную архитектуру. Изначально она была разложена **layer-first** (`controllers/<feature>/`, `use-cases/<feature>/`, …) — слой сверху, фича внутри. На практике это «размазывает» одну фичу по N верхним папкам. Плюс наша же дока противоречила: диаграмма в CLAUDE.md показывала `modules/<feature>/` (feature-first), а `backend.md`/`architecture.md` — layer-first.

Ключевая мысль: **архитектура — это правила зависимостей и поток, а не раскладка файлов**. Те же правила можно спроецировать на папки иначе, не меняя архитектуру.

## Решение

**Feature-first** (вертикальный слайс) + **вынесенный ORM-слой**:

```
src/
  modules/<feature>/          # слайс области, БЕЗ ORM
    controllers/ use-cases/ domain-services/
    adapters/                 # порты: интерфейсы + DI-токены
    interfaces/ dtos/
    <feature>.module.ts       # биндит токены портов → реализации из database/
  database/                   # вся связь с Drizzle (видимая граница)
    client/                   # пул + drizzle + токен DRIZZLE
    schemas/ relations/       # orm-схемы централизованно (нужно для relations)
    repositories/<feature>/   # Drizzle-реализации портов
  system/                     # инфра без ORM: config (zod), logging (pino)
  shared/                     # filters, utility-level, общие interfaces
  app.module.ts · main.ts
```

### Что выносится из фичи и почему
- **Схемы (`database/schemas`)** — обязательно: Drizzle хочет единый объект схемы (`relations` ссылаются между таблицами; миграции сканируют одну папку).
- **Репозитории (`database/repositories/<feature>`)** — да: это единственный код, реально импортящий Drizzle. Вынос делает **ORM-границу видимой в одном месте** и держит фичу ORM-free.
- **Порты-адаптеры остаются в фиче** (`modules/<feature>/adapters`): это интерфейсы+DI-токены, домен-facing, без ORM. Репозиторий реализует порт; биндинг — в `<feature>.module.ts`.

### Что НЕ меняется
5 слоёв, поток `controller → use-case → domain-service → adapter(порт) → repository`, правило «кросс-домен только вниз», «домен не знает ORM». Это и есть архитектура (ADR-0030) — она нетронута.

## Альтернативы
- **Layer-first** (как было) — отвергнуто: фича размазана, верхние папки пухнут с ростом числа фич.
- **Репозитории внутри фичи** — отвергнуто: размывает ORM-границу (Drizzle бы импортировался из десятков фич-папок).
- **Схемы внутри фич** — отвергнуто технически: ломает `relations`/единый объект схемы Drizzle.

## Последствия
- `CLAUDE.md`, `backend.md`, `architecture.md` — приведены к feature-first (устранено противоречие).
- Код nest перенесён: `health` → `modules/health/`, БД-клиент → `database/client/`, схемы → `database/schemas/`, фильтр → `shared/filters/`, конфиг/логи → `system/`.
- Со S1: новые области создаются как `modules/<feature>/` + `database/{schemas,repositories/<feature>}`.
