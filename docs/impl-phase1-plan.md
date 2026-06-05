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
- [x] **A1** — ✅ нижние слои account собраны и связаны (снизу вверх, каждый слой = подэтап + файл):
  - [x] **A1.1** — ✅ интерфейсы `Account`: Pure→Base→Full (+ Read=Omit secrets, Create=Base) в `modules/account/interfaces/`. Ключи Full=14 колонок, схема не сломана.
  - [x] **A1.2** — ✅ VO `Login`/`Alias`/`Password` (`modules/account/value-objects/`) + доменные ошибки (`shared/errors/`: DomainError+ValidationError), filter мапит DomainError→конверт. Проверено вживую.
  - [x] **A1.3** — ✅ `HashService` argon2id (`shared/services/hash.service.ts`, `hash()`/`verify()`, наружу только строки) + глобальный `SharedModule` (подключён в AppModule). Проверено: build, hash→verify roundtrip, boot с DI.
  - [x] **A1.4** — ✅ порт `AccountRepositoryPort` + токен `ACCOUNT_REPOSITORY` (`modules/account/adapters/`): findById, findByLoginNormalized, existsByLoginNormalized, create, updateWithVersion (CAS), decrement/incrementInvitesRemaining. Тип `AccountMutable`. Без ORM.
  - [x] **A1.5** — ✅ `AccountRepository implements AccountRepositoryPort` (`database/repositories/account/`): find/exists/create/updateWithVersion(CAS)/decr-incr квоты, маппинг row→`AccountFull`, инъекция DRIZZLE. Проверено вживую против БД (включая CAS-конфликт и атомарный счётчик).
  - [x] **A1.6** — ✅ `account.module.ts` (DI: `ACCOUNT_REPOSITORY`→`AccountRepository`, exports токен), подключён в AppModule. Boot проверен (DI-граф резолвится).
- [x] **A2** — ✅ `RegisterAccount` (free-режим) + флаги/режим. Полная 5-слойка через HTTP проверена вживую (register 201, валидация 400, БД). Invite-ветка — на этапе I.
  - [x] **A2.1** — ✅ `AccountDomainService.createAccount` (`modules/account/domain-services/`): проверка логина + хеш + `generateId` + `repo.create`, квота из ENV; `LoginTakenError` (409); экспортнут из `account.module`. Проверено вживую. TODO про гонку UNIQUE(lower(login)).
  - [x] **A2.2** — ✅ use-cases `auth` (`modules/auth/use-cases/`): `RegisterAccountUseCase` (free; raw→VO; кросс-домен вниз→account; passwordHash срезан; invite→TODO/InviteRequiredError) + `GetFeatureFlags`/`GetRegistrationMode`. Проверено вживую.
  - [x] **A2.3** — ✅ `RegisterDto` (zod `.strict()` closed-shape, `modules/auth/dtos/`) + кастомный `ZodValidationPipe` (`shared/pipes/`, без nestjs-zod). Типы ответов — FeatureFlags/RegistrationMode/AccountRead (есть). Проверено вживую (валидный/битый/лишнее поле).
  - [x] **A2.4** — ✅ controllers `auth` (`modules/auth/controllers/`): `AuthController` (POST register с zod-пайпом→RegisterResponse, GET registration-mode), `FeatureFlagsController` (GET). Прямой тест ок; HTTP live — на A2.5.
  - [x] **A2.5** — ✅ `auth.module` (controllers+use-cases, import `AccountModule`) + подключён в AppModule. Live HTTP: register 201 (полная цепочка→БД), валидация 400+details, флаги/режим 200.
- [x] **A3** — ✅ `LoginAccount` + JWT(access) + sessions(refresh httpOnly) + Guard. Весь auth-флоу через HTTP проверен (login Set-Cookie HttpOnly, refresh-ротация, reuse→401, logout). Бан-чек login-allowed — на I2 (TODO).
  - [x] **A3.1** — ✅ deps `@nestjs/jwt`+`cookie-parser` + `AccessTokenService` (`modules/auth/services/`: sign(accountId)→JWT, verify→accountId, бросает на невалидном). Секрет/TTL — в JwtModule (A3.6). Проверено вживую.
  - [x] **A3.2** — ✅ слайс sessions: порт+токен, Drizzle-репо (create/findByTokenHash/rotate-CAS/revoke), `SessionDomainService` (token_hash=SHA-256; create/rotate+reuse-detect→revoke all/revoke), `sessions.module`. Utils token/duration, `InvalidRefreshError`. Проверено вживую. TODO: lineage для реплея старого токена.
  - [x] **A3.3** — ✅ `AccountDomainService.authenticate` (lower(login)+argon2 verify+deleted/deactivated; `BadCredentialsError` 401; ban→TODO I2) + `LoginDto` + `LoginAccountUseCase` (account↓→access JWT+sessions↓). Проверено вживую.
  - [x] **A3.4** — ✅ `RefreshTokensUseCase` (sessions.rotate↓→новый access+refresh; rotateSession отдаёт accountId) + `LogoutUseCase` (revoke). Проверено: ротация/старый refresh→401/logout→401.
  - [x] **A3.5** — ✅ `AuthGuard` (Bearer→verify→getActiveById→req.account) + `cookie-parser` + `auth.controller` login/refresh/logout (refresh в httpOnly+SameSite=Lax+Path cookie). Live HTTP проверено.
  - [x] **A3.6** — ✅ `auth.module` (JwtModule из конфига, import SessionsModule+AccountModule, providers use-cases+AccessTokenService+AuthGuard export). Роуты смаппились, флоу работает.
- [⏸️] **A4** — ⏸️ **ОТЛОЖЕН: Jest/unit-тесты пока не пишем** (решение Elmir; верификация — live-прогонами node/HTTP). Подэтапы ниже — план на момент возврата. Вернуться, когда скажет Elmir.
  - [ ] **A4.1** — Jest-инфраструктура: проверить конфиг (есть в package.json), хелперы/фабрики моков портов (`AccountRepositoryPort`/`SessionRepositoryPort`), фикстуры (валидный AccountFull). `nest/test/` или `*.spec.ts` рядом.
  - [ ] **A4.2** — unit VO + utils: `Login`/`Alias`/`Password` (валидные/невалидные/normalize/equals), `parseDurationMs`, `sha256Hex`/`generateOpaqueToken`, `generateId` (формат).
  - [ ] **A4.3** — unit domain-services (моки портов): `AccountDomainService` (createAccount: LOGIN_TAKEN/квота; authenticate: BAD_CREDENTIALS/deleted/deactivated), `SessionDomainService` (create/rotate+reuse→revoke all/revoke).
  - [ ] **A4.4** — unit use-cases (моки domain-services): `RegisterAccount` (free / invite-only→INVITE_REQUIRED), `LoginAccount`, `Refresh` (нет cookie→401), `Logout`.
  - [ ] **A4.5** — (опц.) e2e supertest на тестовой БД: register→login→refresh→logout (если будет время; иначе перенести).

### I. Инвайты + дерево + баны
- [x] **I1** — ✅ invite_codes + invitations (квота, транзакции), снизу вверх. Решение по транзакциям: квота создания/отзыва инвайта — атомарный счётчик + компенсация; регистрация по коду — настоящая транзакция (`TransactionRunner`). Все I1.1–I1.5 закрыты и проверены вживую.
  - [x] **I1.1** — ✅ иерархии `InviteCode`/`Invitation` Pure→Base→Full(+Create) (схема не сломана) + VO `InviteCodeValue` (generate безопасный алфавит / create нормализация+валидация). Проверено вживую.
  - [x] **I1.2** — ✅ `InviteRepositoryPort`+Drizzle-репо (createCode/findActiveCodeByValue/deleteCode/insertInvitation/listInviteesByInviter, tx-aware). **Транзакции**: опаковый `Transaction` + `TransactionRunner` (shared-порт + Drizzle-раннер в DatabaseModule) — домен оркестрирует tx без ORM. Проверено: atomic consume + rollback.
  - [x] **I1.3** — ✅ `InviteDomainService`: createCode (код+срок, БЕЗ счётчика — кросс-домен у use-case), revokeCode (владение→delete), consumeCode (в tx: delete-гард одноразовости + insertInvitation), checkCode, listInvitees. `InviteInvalidError`. Проверено вживую (включая double-consume→INVITE_INVALID).
  - [x] **I1.4** — ✅ DTO+use-cases+controller invites: Create/Revoke/Check/ListMyInvitees (`POST/DELETE /invites`, `POST /invites/check` public, `GET /invites` под Guard) + `invites.module`+AppModule. Квота через **компенсацию** (decrement атомарен; на сбое — increment назад), не tx. `QuotaExceededError` (403). Попутно: первый защищённый чужим модулем роут вскрыл DI-нюанс — guard из `@UseGuards` инстанцируется в DI-скоупе модуля-контроллера, поэтому `AuthModule` теперь экспортит `AccessTokenService`+реэкспорт `JwtModule` (не только `AuthGuard`). Проверено вживую: create→201 (квота 3→2), check valid, #4→403 QUOTA_EXCEEDED, revoke→204, check после revoke→valid:false, #5→201, no-auth→401.
  - [x] **I1.5** — ✅ invite-режим регистрации (**TODO A2.2 закрыт**): `createAccount`/account-репозиторий теперь принимают `tx?`; `RegisterAccountUseCase` invite-ветка → `TransactionRunner.run`: createAccount(source='invite') + `consumeCode` (ребро приглашения) атомарно. Попутно **ADR-0037**: контроль доступа вынесен в `AccessControlModule` (guard+access-token), разрывает цикл `AuthModule⇄InvitesModule` (auth-флоу зависит вниз от invites ради регистрации по коду). Проверено вживую (2 фазы): без кода→403 INVITE_REQUIRED, плохой код→400 + откат (аккаунт не создан), валидный→201 source=invite + ребро, повтор→400, inviter видит приглашённого; БД: 1 ребро, 0 живых кодов.
- [x] **I2** — ✅ InviteTree (рекурсивный CTE) + bans + бан-чек login/Guard, снизу вверх. Таблица `bans` была уже в миграции 0000. Все I2.1–I2.5 закрыты и проверены вживую; **TODO A3.3/A3.5 закрыты** (бан-чек вынесен в login-use-case + Guard, account-домен остался bans-agnostic).
  - [x] **I2.1** — ✅ `InviteTreeRepositoryPort` + рекурсивный CTE (вверх по `invitations.inviter_id`, первый `db.execute` в проекте) `isAncestor` в `database/repositories/invite-tree/`. `InviteTreeDomainService` — точка кросс-домена вниз; экспортнут из `InvitesModule`. Проверено вживую (транзитивный/прямой предок→разрешён, вверх/сам→запрещён).
  - [x] **I2.2** — ✅ bans-домен: interfaces Pure→Base→Create + Full переписан на наследование (`active` — системное, в Full) + `BanRepositoryPort`+Drizzle-репо: `createBan` (идемпотентно через `onConflictDoUpdate` на partial-unique — повтор обновляет причину, тот же id), `deactivateOwn`, `existsActiveByTarget`, `listActiveByTarget`, `listByBanner`; `bans.module`. Попутно: `AccessControlModule` реэкспортит `AccountModule` (зависимость guard'а едет с ним — иначе bans-контроллер не резолвил бы `AccountDomainService`).
  - [x] **I2.3** — ✅ `BanDomainService` (idempotent ban / unban своей записи) + use-cases (`BanUser`: `isAncestor`↓ через InviteTree, нельзя себя/вверх; `UnbanUser`; `ListMyBans`) + `create-ban.dto` + `BansController` (`POST/DELETE /bans`, `GET /bans`, Guard) + `BanForbiddenError`(403)/`BanNotFoundError`(404). Проверено вживую (9 сценариев + БД: идемпотентность, владение, история снятых).
  - [x] **I2.4** — ✅ login учитывает бан (**TODO A3.3 закрыт**): `AccountBannedError` (403 `ACCOUNT_BANNED`, `details.bans`=банивший+причина, ADR-0012) + `DomainError.details` + прокидка в фильтре. `LoginAccountUseCase` оркестрирует `authenticate`↓ + `bans.listActiveAgainst`↓ → бросает с деталями. Проверено вживую (login забаненного → 403 с details).
  - [x] **I2.5** — ✅ Guard учитывает бан (**TODO A3.5 закрыт**) + **ADR-0038**: бан-чек живёт в оркестраторах (login + Guard), цикл разорван выносом `BanCoreModule` (логика банов без зависимости от AccessControl; реэкспортнут из `AccessControlModule` для guard'а). Бан действует **немедленно**. Проверено вживую: забаненный со старым валидным токеном → 403 на защищённом роуте; разбан восстанавливает доступ.

### R. Восстановление + профиль + сессии
- [ ] **R1** — восстановление по секретным вопросам (ADR-0008: 1:N вопросы, K-of-N, вне регистрации), снизу вверх. NB: таблица `secret_qa` (1:N к accounts, индекс по `account_id`) **уже в миграции 0000**; `SecretQaFull` — плоский stub (развернуть); `AccountMutable` уже включает `passwordHash`+`recoveryRequiredCount` → сброс пароля и установка K идут через существующий CAS `updateWithVersion`. Слайс — новый модуль `recovery` (типы `SecretQa*` переехать из `modules/auth/interfaces`, поправить импорт схемы).
  - [x] **R1.1** — ✅ слайс `recovery`: `SecretQa` Pure→Base→Full(+Create) (stub развёрнут; `question` в Pure, `accountId`/`answerHash` в Base, метки в Full) + view-типы (`SecretQaView`, `RecoveryQuestion` = `{id,question}` без answerHash). VO `SecretAnswer` (trim+lower+схлоп — стабильный хеш) и `SecretQuestion` (длина 8–200; чёрный список тем — TODO до согласования списка). Типы переехали из `auth/interfaces`, импорт схемы поправлен.
  - [x] **R1.2** — ✅ `SecretQaRepositoryPort` + Drizzle-репо (`add`, `listByAccount`, `removeOwn`, `countByAccount`, `findByIdsForAccount`) + `recovery.module` (биндинг токена). Проверено live (smoke по БД): add→Full, count, owner-изоляция `findByIdsForAccount`/`removeOwn`, пустой-ids гард.
  - [x] **R1.3** — ✅ `SecretQaDomainService` (addQuestion с argon2-хешем↓, removeOwn→`SecretQaNotFoundError`, listQuestions, countQuestions, pickRandomK Fisher–Yates, verifyAnswers — уникальность id + сверка ВСЕХ) + расширения `AccountDomainService`: `resetPassword` (argon2 + приватный `_applyWithRetry` CAS, `OPTIMISTIC_RETRY_ATTEMPTS`), `setRecoveryRequiredCount` (CAS; `1≤K≤N` валидирует use-case), `findRecoveryAccountByLogin` (узкая проекция `{id,recoveryRequiredCount}` без секретов, исключает удалённых). Проверено live (smoke): нормализация ответа → стабильный хеш (барсик≡«  Барсик »), reset (старый отвергнут/новый принят), owner-изоляция, дубликат/чужой id → false.
  - [ ] **R1.4** — settings (Guard): use-cases Add/Remove/ListMySecretQuestions + SetRecoveryRequiredCount (**кросс-домен**: count↓ + проверка `1≤K≤N` + account update↓) + DTO + контроллер `GET/POST /recovery/questions`, `DELETE /recovery/questions/:id`, `PUT /recovery/required-count`. `RecoveryRequiredCountInvalidError`.
  - [ ] **R1.5** — recovery-флоу (**public**): StartRecovery (`login`→K случайных `{id,question}`; **анти-энумерация логинов** — единый ответ + rate-limit на F5, пока TODO) + CompleteRecovery (`login`+ответы[K]+новый пароль → verify все K → `resetPassword`↓; опц. отзыв сессий) + DTO + контроллер `POST /recovery/start`, `POST /recovery/complete`. `RecoveryNotAvailableError`(409)/`RecoveryFailedError`(401).
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
