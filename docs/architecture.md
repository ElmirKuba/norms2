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

## 5-слойная архитектура (строго)

Слои — папками в корне `nest/src` (не внутри каждого модуля). Каждая доменная область (`account`, `courses`, …) представлена в каждом слое:

```
nest/src/
├─ api-endpoints/        # СЛОЙ 1: контроллеры — HTTP, валидация DTO, вызов менеджера
├─ managers-level/       # СЛОЙ 2: бизнес-оркестрация; ТОЧКА кросс-доменных вызовов
├─ use-cases-level/      # СЛОЙ 3: атомарные операции одной доменной области
├─ adapters/             # СЛОЙ 4: граница домен↔инфраструктура (порт-подобный)
├─ drizzle-repositories/ # СЛОЙ 5: доступ к данным через Drizzle
├─ system/               # orm-schemas, orm-relations (Drizzle), системные сервисы
├─ interfaces/           # типы/контракты (pure-and-base, full, with-child, systems…)
├─ dtos/                 # input/output DTO
├─ utility-level/        # утилиты (generateId и пр.)
├─ filters/  gateways/   # exception filters, ws-gateways
└─ app.module.ts · main.ts   # только bootstrap
```

**Поток вызова:** `controller (api-endpoints) → manager (managers-level) → use-case (use-cases-level) → adapter (adapters) → repository (drizzle-repositories)`.

## Правила зависимостей (вниз, не вбок)

- Каждый слой зовёт **только слой ниже** своей доменной области.
- `use-cases`/`managers` не импортируют Drizzle — доступ к данным только через `adapters` → `drizzle-repositories`. Замена ORM = переписать `drizzle-repositories` (+ adapters при нужде), бизнес-слои не трогаем.
- **Кросс-доменное взаимодействие — ТОЛЬКО ВНИЗ** ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)):
  - `manager` области **A** может звать `use-case` области **B** (слой ниже), но **НЕ** `manager` области B.
  - Поскольку `use-case` не зависит от `manager`, цикла NestJS-DI не возникает.
  - Пример: `account.manager → courses.use-case` И `courses.manager → account.use-case` — оба валидны, цикла нет. Именно это решает круговую DI (ради чего и 5 слоёв, а не 4).

## Shared / системное

`utility-level` + `interfaces` + `system` — кросс-доменные примитивы: `Id` (VO `uuidv7___unixmillis`), `generateId()`, базовые ошибки, Drizzle-схемы/связи. Области импортят из них, **не друг из друга напрямую** (только через правило «manager→чужой use-case»).

## Модули фазы 1 (доменные области)

`account` (профиль/жизненный цикл), `auth` (регистрация/вход/токены/восстановление), `invites` (коды+дерево), `bans`, `sessions`. Раздел «Акцент» (фаза 2), «НоваСкил» (фаза 3) — добавляют свои области в те же 5 слоёв. Роли (`roles`/`account_roles`) — платформенная область ([ADR-0029](./decisions/0029-novaskil-phase3-core.md)).

## Сквозные механизмы ([ADR-0019](./decisions/0019-backend-architecture-conventions.md), в силе)

- **Конфиг:** `@nestjs/config` + zod-валидация ENV, fail-fast; только `ConfigService`.
- **Ошибки:** единый конверт `{ error: { code, message, details? } }` через глобальный exception filter.
- **Логи:** pino (структурный JSON), `request-id`; тела с секретами не логируются.
- **Идемпотентность:** уникальные ограничения БД; операции безопасны к ретраю.
- **id:** `Id` VO, util `generateId()` (общий с фронтом).

## Поток данных (пример: регистрация по коду)

```
api-endpoints (controller + DTO)
  → managers-level: RegisterAccount (оркестрация; при нужде зовёт use-case других областей ВНИЗ)
      → use-cases-level: проверка квоты/кода, создание account+invitation, погашение кода (транзакция)
          → adapters → drizzle-repositories (Drizzle)
  ← результат → DTO (без токенов) → редирект на вход
```

## Безопасность/приватность

Плейнтекст-секреты только по TLS, хешируются в нижних слоях (argon2id, [ADR-0009](./decisions/0009-server-side-hashing.md)). `security_logs` — без связи с доменом ([152fz — приватный]). Бан — производное (`EXISTS active ban`, [ADR-0012](./decisions/0012-bans-derived-status.md)).
