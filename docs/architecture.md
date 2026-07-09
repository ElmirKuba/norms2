# architecture.md — архитектура бэкенда

> Источник истины по **слоям, модулям и потокам данных** бэкенда. Стек/слои — [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md) (заменил 4-слойку/TypeORM из [ADR-0019](./decisions/0019-backend-architecture-conventions.md); прочие конвенции 0019 — конфиг/ошибки/логи/идемпотентность — в силе). Домен — [`domain-model.md`](./domain-model.md). Схема БД — [`database.md`](./database.md). Образец реализации — `~/coding/kuba-game/nest-backend`.

## Монорепо

```
norms2/
├─ nest/        # backend (NestJS + Drizzle)
├─ angular/     # frontend (Angular SPA)
├─ docs/        # документация
└─ docker-compose.*.yml
```
У `nest/` и `angular/` — свои `package.json` и `.gitignore`. Пакетный менеджер — **npm** ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)).

## 5-слойная архитектура + feature-first раскладка ([ADR-0034](./decisions/0034-feature-first-layout.md))

Архитектура — это **правила зависимостей и поток**, а не раскладка файлов. Те же 5 слоёв проецируем на папки **по фиче** (вертикальный слайс), а **ORM-слой выносим** в общий `database/` — чтобы граница с Drizzle была в одном видимом месте:

```
nest/src/
├─ modules/<feature>/          # вертикальный слайс области, БЕЗ ORM
│  ├─ controllers/             # СЛОЙ 1: HTTP, валидация DTO, вызов use-case
│  ├─ use-cases/               # СЛОЙ 2: оркестрация сценария; ТОЧКА кросс-домена
│  ├─ domain-services/         # СЛОЙ 3: бизнес-логика области
│  ├─ adapters/                # СЛОЙ 4: ПОРТЫ (интерфейсы + DI-токены) — ORM-free
│  ├─ interfaces/  dtos/       # контракты области / input-output DTO
│  └─ <feature>.module.ts      # биндит токены портов → реализации из database/
├─ database/                   # вся связь с Drizzle (видимая ORM-граница)
│  ├─ client/                  # пул + drizzle-инстанс + токен DRIZZLE
│  ├─ schemas/                 # СЛОЙ 5 (схемы): orm-схемы централизованно (relations)
│  ├─ relations/               # orm-relations
│  └─ repositories/<feature>/  # СЛОЙ 5: Drizzle-реализации портов области
├─ system/                     # инфра без ORM: config (zod), logging (pino)
├─ shared/                     # filters, utility-level, общие interfaces
└─ app.module.ts · main.ts     # только bootstrap
```

**Поток вызова (сверху вниз):** `controller → use-case → domain-service → adapter (порт в фиче) → repository (реализация в database/)`. ORM (Drizzle) импортируется **только** в `database/` (schemas + repositories); доменные слои фичи его не видят.

> Простой эндпоинт может задействовать не все слои (напр. `health` = controllers + use-cases + interfaces, без БД).

## Правила зависимостей (вниз, не вбок)

- Каждый слой зовёт **только слой ниже**.
- `use-cases`/`domain-services` не импортируют Drizzle — доступ к данным только через `adapters` → `repositories`. Замена ORM = переписать `repositories` (+ adapters при нужде), бизнес-слои не трогаем.
- **Кросс-доменное взаимодействие — ТОЛЬКО ВНИЗ** ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)):
  - `use-case` области **A** может звать `domain-service` области **B** (слой ниже), но **НЕ** `use-case` области B.
  - Поскольку `domain-service` не зависит от `use-case`, цикла NestJS-DI не возникает.
  - Пример: `account.use-case → courses.domain-service` И `courses.use-case → account.domain-service` — оба валидны, цикла нет. Именно это решает круговую DI (ради чего 5 слоёв, а не 4).
- **Связывание модулей:** у каждой области один `<feature>.module.ts`. Он объявляет провайдеры слоёв области, **биндит DI-токен порта** (из `adapters/`) на конкретную реализацию-репозиторий из `database/repositories/<feature>/`, и `imports` нужные `<feature>.module` других областей для кросс-доменных вызовов (вниз: use-case A → domain-service B). `database/client` — глобальный модуль (токен `DRIZZLE`).

## Shared / системное / database

- **`shared/`** — кросс-доменные примитивы без ORM: `utility-level` (`generateId()` и пр.), общие `interfaces` (`Id` VO `uuidv7___unixmillis`, базовые ошибки), `filters`.
- **`system/`** — инфраструктура без ORM: `config` (zod), `logging` (pino).
- **`database/`** — всё про Drizzle: `client` (соединение, токен `DRIZZLE`), `schemas`/`relations` (orm-схемы централизованно), `repositories/<feature>` (реализации портов).

Области импортят примитивы из `shared`/`system`, **не друг из друга напрямую** (только через правило «use-case → чужой domain-service»).

## Модули фазы 1 (доменные области)

`account` (профиль/жизненный цикл), `auth` (регистрация/вход/токены/восстановление), `invites` (коды+дерево), `bans`, `sessions`. Раздел «Акцент» (фаза 2), «НоваСкил» (фаза 4) — добавляют свои области в те же 5 слоёв. Роли (`roles`/`account_roles`) — платформенная область ([ADR-0029](./decisions/0029-novaskil-phase3-core.md)).

## Сквозные механизмы ([ADR-0019](./decisions/0019-backend-architecture-conventions.md), в силе)

- **Конфиг:** `@nestjs/config` + zod-валидация ENV, fail-fast; только `ConfigService`.
- **Ошибки:** единый конверт `{ error: { code, message, details? } }` через глобальный exception filter.
- **Логи:** pino (структурный JSON), `request-id`; тела с секретами не логируются.
- **Идемпотентность:** уникальные ограничения БД; операции безопасны к ретраю.
- **id:** `Id` VO, util `generateId()` в `shared/utility-level` (**параллельная копия** на фронте, не шарим — без workspace).

## Поток данных (пример: регистрация по коду)

```
controllers (controller + DTO)
  → use-cases: RegisterAccount (оркестрация; при нужде зовёт domain-service других областей ВНИЗ)
      → domain-services: проверка квоты/кода, создание account+invitation, погашение кода (транзакция)
          → adapters → repositories (Drizzle)
  ← результат → DTO (без токенов) → редирект на вход
```

## Безопасность/приватность

Плейнтекст-секреты только по TLS, хешируются в нижних слоях (argon2id, [ADR-0009](./decisions/0009-server-side-hashing.md)). Бан — производное (`EXISTS active ban`, [ADR-0012](./decisions/0012-bans-derived-status.md)). (Логи безопасности в фазе 1 не ведём — [ADR-0032](./decisions/0032-phase1-refinements.md).)
