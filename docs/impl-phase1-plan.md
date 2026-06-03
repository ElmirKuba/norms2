# impl-phase1-plan.md — план реализации Фазы 1 (resumable)

> Пошаговый план кодинга ЛК. Лимиты ~5ч непредсказуемы → дробим на мелкие этапы, каждый = рабочая точка + коммит. На новой сессии: открыть этот файл → «Текущая позиция» → продолжить. Дока-источник: `docs/` (database, domain-model, api-contracts, backend, architecture, getting-started) + ADR.
>
> Стек: NestJS (5-слойка: controllers→use-cases→domain-services→adapters→repositories) + Drizzle + Postgres, npm, Docker. Angular standalone+Signals, SCSS, MatDialog. id `uuidv7___unixmillis`.

## Текущая позиция (по факту)
- **Окружение:** Node 24, npm 11, Docker 29, Angular CLI глобально, nest — через npx.
- **`nest/` B2+B3 ГОТОВ:** NestJS 11. Конфиг zod fail-fast (`system/config`), логи pino (`system/logging`), Drizzle (`database/client`: `DatabaseService`+токен `DRIZZLE`, схемы `database/schemas`; `db:generate/migrate/studio`), health (`modules/health`), exception-filter (`shared/filters`). **Раскладка — feature-first + вынесенный `database/`** ([ADR-0034](./decisions/0034-feature-first-layout.md)). Сборка `tsc` зелёная. ⚠️ **Линт nest красный** — почистить под строгий eslint отдельно (Sonnet).
- **`angular/` СОЗДАН:** Angular 21, standalone + Signals, SCSS, npm. Строгий eslint согласован с nest. Оболочка `App` с `<router-outlet/>`; `index.html` — `lang="ru"`, title «Нормисы». `build`+`lint`+`test` зелёные.
- **Docker dev:** `make dev-up` → postgres + pgadmin + **nest (watch, volume на src)**; пути через `${PROJECT_ROOT}`. Hot-reload проверен.
- **Следующий: S1** (первые таблицы Drizzle в `database/schemas`: accounts, secret_qa, invite_codes, invitations, bans, sessions; тогда же — ADR по concurrency/`version`).
- **Версии:** всё — latest stable на сегодня ([ADR-0021](./decisions/0021-tooling-defaults.md)).

## Этапы (каждый — отдельный коммит)

### B. Bootstrap
- [x] **B1** — `nest/` каркас ✅ (NestJS 11, npm, строгие tsconfig+eslint, JSDoc на русском, сборка зелёная) + `angular/` каркас ✅ (Angular 21, standalone+Signals, SCSS, строгий eslint согласован с nest, оболочка с router-outlet, build/lint/test зелёные).
- [x] **B2** — ✅ docker `compose-files/docker-compose.dev.yml` (postgres+pgadmin+nest watch с volume на src), `.env.example`, Drizzle + drizzle-kit в nest (`system/database`, токен `DRIZZLE`, `db:generate/migrate/studio`), конфиг zod fail-fast (`system/config`), Makefile `db-*`. Проверено вживую: бэк стартует (хост+контейнер), пинг БД, fail-fast, hot-reload. ⚠️ Линт nest пока красный — почистить отдельно (Sonnet).
- [x] **B3** — ✅ health `GET /api/v1/health` (liveness) + `/health/ready` (readiness, пинг БД→503 если недоступна), глобальный префикс `/api/v1`, CORS на dev-фронт, глобальный exception-filter (конверт `{error:{code,message,details?}}`, 5xx без стектрейса наружу), pino (`nestjs-pino`: request-id, redact секретов, pretty в dev, health вне autoLogging). 5-слойка: `controllers/health`→`use-cases/health`→`interfaces/health`, фильтр в `filters/`, логи в `system/logging`. Проверено вживую: health/ready→200, 404→конверт, pino-логи.
- [x] **B4** — ✅ util `generateId()` (uuidv7___unixmillis, ADR-0016) — параллельные копии без зависимостей: `nest/src/shared/utility-level/generate-id.util.ts` и `angular/src/app/core/utils/generate-id.util.ts` (не шарим). Каркас 5-слойки — сделан при feature-first переезде (`system/`, `modules/`, `database/`, `shared/`).

### S. Схема БД (Drizzle)
- [x] **S1** — ✅ S1.1 concurrency ([ADR-0035](./decisions/0035-concurrency-control.md)); S1.2 Drizzle-схемы 6 таблиц в `database/schemas/` (accounts с `version`, CHECK `registration_source`, `UNIQUE(lower(login))`; partial-unique на bans; FK `ON DELETE RESTRICT`) + relations + хелпер `_shared`.
- [x] **S2** — ✅ первая миграция `drizzle/0000`, накатана в dev, 6 таблиц проверены в БД (psql).

### A. Модуль auth (регистрация/вход) — ядро
- [ ] **A1** — нижние слои account (снизу вверх, каждый слой = подэтап + указание файла):
  - [x] **A1.1** — ✅ интерфейсы `Account`: Pure→Base→Full (+ Read=Omit secrets, Create=Base) в `modules/account/interfaces/`. Ключи Full=14 колонок, схема не сломана.
  - [ ] **A1.2** — VO `Login`/`Alias`/`Password` (валидация ADR-0006/0032) (`modules/account/value-objects/`).
  - [ ] **A1.3** — хеш-сервис argon2id (общий для пароля/ответов) (`shared/services/hash.service.ts`).
  - [ ] **A1.4** — порт `AccountRepositoryPort` + DI-токен `ACCOUNT_REPOSITORY` (`modules/account/adapters/`).
  - [ ] **A1.5** — репозиторий-реализация на Drizzle: маппинг row→`AccountFull`, CAS по `version` (`database/repositories/account/`).
  - [ ] **A1.6** — `account.module.ts` (DI: токен→репозиторий).
- [ ] **A2** — `RegisterAccount` (use-case + domain-services accounts/invites), `/auth/register`, `/feature-flags`, `/auth/registration-mode`.
- [ ] **A3** — `LoginAccount` + JWT (access) + sessions (refresh httpOnly), `/auth/login`, `/auth/refresh`, `/auth/logout`. Guard.
- [ ] **A4** — тесты use-cases (рег оба режима, login/ban-check).

### I. Инвайты + дерево + баны
- [ ] **I1** — invite_codes + invitations: `CreateInvite`/`RevokeInvite`/`ConsumeInvite`/`CheckInviteCode`, эндпоинты, квота-счётчик, транзакции.
- [ ] **I2** — InviteTree (рекурсивный CTE isAncestor/subtree); bans: `BanInMySubtree`/`Unban`/`ListMyBans`, эндпоинты; login учитывает бан.

### R. Восстановление + профиль + сессии
- [ ] **R1** — secret_qa: add/remove/required-count; recovery start/complete (K-of-N).
- [ ] **R2** — профиль: me/:login/patch-alias/deactivate/reactivate/delete; аватар upload/delete (диск).
- [ ] **R3** — сессии: list/revoke/revoke-others.

### F. Фронт ЛК
- [ ] **F1** — core: auth-сервис (Signals), http-interceptor (401→refresh), guard, generateId, модальная система (`_shared/modal-system`).
- [ ] **F2** — auth-экраны: cookie-гейт, register (проверка рег-режима по клику), login, recover.
- [ ] **F3** — profile (my/user + аватар-кроп в модалке), invites (создать/отозвать/список), bans (в карточке), sessions, settings (секретные вопросы).

### D. Деплой
- [ ] **D1** — docker-compose.prod, Traefik+LE, прогон миграций, деплой «для друзей».

## Принципы кодинга (из доки)
- **Типы — иерархией** `Pure→Base→Full` + производные утилитами (`Pick`/`Omit`/`Required`/`Partial`), классы через `implements`; одно свойство — одно место; per-project (не шарим фронт↔бэк) ([ADR-0033](./decisions/0033-type-hierarchy-convention.md)). Применяется со S1/A1.
- 5-слойка строго; кросс-домен только вниз (use-case→чужой domain-service).
- Бизнес-слои не импортируют Drizzle. Конфиг только через ConfigService. Без `any`.
- Каждый завершённый этап: сборка проходит → коммит → отметка здесь.
- Один коммит = один слой/одна фича (не мешать nest+angular в одном).

## Заметки/риски
- nest и angular — свои package.json (монорепо без workspace, как договорено).
- Пароль 3–64 (осознанный риск, ADR-0032).
- Аватар — фронт режет, бэк принимает готовое (ADR-0032).
