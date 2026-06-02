# impl-phase1-plan.md — план реализации Фазы 1 (resumable)

> Пошаговый план кодинга ЛК. Лимиты ~5ч непредсказуемы → дробим на мелкие этапы, каждый = рабочая точка + коммит. На новой сессии: открыть этот файл → «Текущая позиция» → продолжить. Дока-источник: `docs/` (database, domain-model, api-contracts, backend, architecture, getting-started) + ADR.
>
> Стек: NestJS (5-слойка: controllers→use-cases→domain-services→adapters→repositories) + Drizzle + Postgres, npm, Docker. Angular standalone+Signals, SCSS, MatDialog. id `uuidv7___unixmillis`.

## Текущая позиция (по факту)
- **Окружение:** Node 24, npm 11, Docker 29, Angular CLI глобально, nest — через npx.
- **`nest/` СОЗДАН:** NestJS 11, npm, строгий tsconfig (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + noPropertyAccessFromIndexSignature и др.) и строгий eslint (strictTypeChecked + явные типы/возвраты + обязательный JSDoc на русском + readonly + naming-convention; послабления для `*.dto.ts` и `src/system/orm-schemas/*`). Сборка `npm run build` зелёная. Демо-файлы `app.*` пока стоковые (нарушают JSDoc/accessibility — перестроим под 5-слойку на B4).
- **Следующий: B1-angular** (каркас Angular latest stable), затем B2.
- **Версии:** всё — latest stable на сегодня ([ADR-0021](./decisions/0021-tooling-defaults.md)).

## Этапы (каждый — отдельный коммит)

### B. Bootstrap
- [~] **B1** — `nest/` каркас ✅ (NestJS 11, npm, строгие tsconfig+eslint, JSDoc на русском, сборка зелёная); осталось: `angular/` каркас (standalone, SCSS).
- [ ] **B2** — `docker-compose.dev.yml` (postgres), `.env.example`, подключить Drizzle + drizzle-kit к nest, конфиг через zod (fail-fast).
- [ ] **B3** — health-эндпоинт `GET /api/v1/health`, CORS, глобальный exception-filter (конверт ошибок), pino. Фронт дёргает health → «OK».
- [ ] **B4** — utility `generateId()` (uuidv7___unixmillis) на бэке и фронте; базовые `interfaces`/`dtos` каркас 5-слойки.

### S. Схема БД (Drizzle)
- [ ] **S1** — orm-schemas: accounts, secret_qa, invite_codes, invitations, bans, sessions (6 таблиц, ADR-0032 — без security_logs).
- [ ] **S2** — первая миграция drizzle-kit, прогон в dev, проверка таблиц.

### A. Модуль auth (регистрация/вход) — ядро
- [ ] **A1** — VO Login/Alias/Password (валидация); хеш-сервис argon2id; репозиторий accounts (adapter+repository).
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
- 5-слойка строго; кросс-домен только вниз (use-case→чужой domain-service).
- Бизнес-слои не импортируют Drizzle. Конфиг только через ConfigService. Без `any`.
- Каждый завершённый этап: сборка проходит → коммит → отметка здесь.
- Один коммит = один слой/одна фича (не мешать nest+angular в одном).

## Заметки/риски
- nest и angular — свои package.json (монорепо без workspace, как договорено).
- Пароль 3–64 (осознанный риск, ADR-0032).
- Аватар — фронт режет, бэк принимает готовое (ADR-0032).
