# ADR-0030: Ревизия стека — Drizzle, 5-слойная архитектура, npm

- **Статус:** accepted
- **Дата:** 2026-05-31
- **Решает:** Elmir
- **Контекст-теги:** [architecture] [backend] [db] [tooling]
- **Заменяет:** ORM-часть [ADR-0019](./0019-backend-architecture-conventions.md) (был TypeORM + 4 слоя) и [ADR-0021](./0021-tooling-defaults.md) (был pnpm). НоваСкил [ADR-0029](./0029-novaskil-phase3-core.md) — уже Drizzle, согласован.

## Контекст
По мере проектирования Elmir уточнил стек по образцу рабочего проекта `kuba-game` (`/Users/elmirkuba/coding/kuba-game/nest-backend`): Drizzle вместо TypeORM, 5-слойная архитектура вместо 4-слойной (она реально разруливает круговую DI), npm вместо pnpm.

## Решения

### 1. ORM — Drizzle + PostgreSQL (не TypeORM)
- Репозитории — слой `drizzle-repositories`. Схемы — `system/orm-schemas`, связи — `system/orm-relations`.
- Принцип «инкапсуляции доступа к данным» сохраняется: домен/use-cases не знают про Drizzle, ходят через adapters.
- Миграции — средствами Drizzle (drizzle-kit), явные; без auto-push в проде.

### 2. 5-слойная архитектура backend (не 4-слойная)
Слои папками в корне `src`. Порядок СВЕРХУ ВНИЗ (как в kuba-game), поток `controller → use-case → manager → adapter → repository`:

1. **`api-endpoints`** — контроллеры: HTTP, валидация входа (DTO), вызов **use-case**.
2. **`use-cases-level`** — верхнеуровневая оркестрация сценария. **Точка кросс-доменных вызовов.** Зовёт manager(ы) своей и/или других областей.
3. **`managers-level`** — бизнес-логика одной доменной области; зовёт adapter своей области.
4. **`adapters`** — граница домен↔инфраструктура (порт-подобный слой); зовёт репозитории.
5. **`drizzle-repositories`** — доступ к данным через Drizzle.

Вспомогательные: `system` (orm-schemas/relations), `interfaces`, `dtos`, `utility-level`, `filters`, `gateways`.

**Зачем именно 5 слоёв (разрешение круговой DI) — ключевое:**
Кросс-доменные зависимости идут **только вниз**: `use-case` области A может звать **`manager` другой** области B (слой ниже), а НЕ её use-case. `manager` не зависит от `use-case` → цикла NestJS-DI нет.
Пример: `account.use-case → courses.manager` И `courses.use-case → account.manager` — оба валидны, цикла нет. В 4-слойке (norms) такого разведения не было, отсюда риск `forwardRef`/циклов; 5-слойка снимает это структурно и делает систему расширяемой.
(Связывание модулей: каждый модуль слоя `imports` модуль слоя ниже и `exports` свой сервис; пример из kuba-game: `*.manager.module → imports AdapterModule`, `*.use-case.module → imports ManagerModule(ы)`, controller-module → imports UseCaseModule.)

### 3. Пакетный менеджер — npm (не pnpm)
Единообразно с другими проектами Elmir (kuba-game на npm). pnpm-преимущества (диск/скорость) для нас не перевешивают привычность npm. Применяется к `nest/` и `angular/`.

## Альтернативы
- TypeORM (ADR-0019) — отвергнут: Elmir выбрал Drizzle (легче, ближе к SQL, как в kuba-game).
- 4-слойка (ADR-0019) — отвергнута: не разводит кросс-доменные циклы.
- pnpm (ADR-0021) — отвергнут в пользу npm.

## Последствия (пропагация по доке — чеклист)
Обновить упоминания во всех доках:
- `CLAUDE.md` (всегда грузится): стек Drizzle, 5 слоёв, правило кросс-домена.
- `architecture.md` — 5 слоёв, поток, правило «кросс-домен только вниз».
- `backend.md` — Drizzle, npm, структура `api-endpoints/managers-level/use-cases-level/adapters/drizzle-repositories`.
- `database.md` — Drizzle-миграции (схема таблиц без изменений).
- `getting-started.md`, `deployment.md` — npm.
- `Technical-assignment.md` §стек — Drizzle, npm, 5 слоёв.
- `sections/accent/*`, `sections/novaskil/*` — TypeORM→Drizzle, 4→5 слой.
- ADR-0019/0021 — пометки «частично заменён ADR-0030».
Схема БД, доменные решения, API-контракты, продуктовые фичи — **НЕ меняются** (это только стек/структура слоёв).
