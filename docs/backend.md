# backend.md — правила работы в `nest/`

> Реализация бэкенда. Архитектура/слои — [`architecture.md`](./architecture.md) + [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md). Конвенции — [ADR-0019](./decisions/0019-backend-architecture-conventions.md) (конфиг/ошибки/логи), [ADR-0020](./decisions/0020-api-conventions.md). Домен — [`domain-model.md`](./domain-model.md). Схема — [`database.md`](./database.md). Образец — `~/coding/kuba-game/nest-backend`.

## Стек
NestJS (≥10), TypeScript **strict** (без `any` — `unknown` + сужение), **Drizzle** + drizzle-kit (явные миграции), PostgreSQL, **npm** ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)). Зависимости: `@nestjs/config`, `zod`, `nestjs-zod`, `@nestjs/throttler`, `nestjs-pino`, `argon2`, `@nestjs/jwt`, `cookie-parser`, `drizzle-orm`, `drizzle-kit`.

## 5-слойная структура (папками в `src`, см. [architecture.md](./architecture.md))
```
src/
├─ controllers/<feature>/        # контроллеры + DTO + guards
├─ use-cases/<feature>/      # оркестрация сценария; кросс-домен — вниз
├─ domain-services/<feature>/       # бизнес-логика области
├─ adapters/<feature>/             # граница домен↔инфра
├─ repositories/<feature>/ # Drizzle-доступ
├─ system/   (orm-schemas, orm-relations)
├─ interfaces/  dtos/  utility-level/  filters/  gateways/
└─ app.module.ts · main.ts         # только bootstrap
```
**Кросс-домен только вниз:** `use-case` области A зовёт `domain-service` области B (не её use-case) → круговой DI исключён ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)).

## Конфигурация
- `zod`-схема всех ENV; валидация при старте (**fail-fast** — нет валидного env → не поднимаемся).
- В коде только `ConfigService`, никогда `process.env`.
- ENV (см. также `deployment.md`): `FREE_REGISTRATION`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TTL` (~15m), `REFRESH_TTL` (~30d), `DB_*`, `INVITE_DEFAULT_QUOTA`=3, `INVITE_TTL_DAYS`=3, `COOKIE_SECURE` (true в проде), `AVATAR_MAX_BYTES`.
- **Валидация (zod):** `login` 3–32 `[A-Za-z0-9_]`, `alias` 3–32, `password` **3–64** ([ADR-0032](./decisions/0032-phase1-refinements.md); мин 3 — осознанный риск). Аватар: тип jpeg/png/webp, ≤ `AVATAR_MAX_BYTES`, приходит уже нарезанным с фронта.

## DTO и валидация
- `nestjs-zod`: каждая DTO — zod-схема (closed shape). Пайп валидирует вход; типы выводятся из схемы. Без class-validator-декораторов.

## Ошибки
- Глобальный exception filter → конверт `{ error: { code, message, details? } }`.
- Доменные ошибки — типизированы (`shared/errors`), мапятся на HTTP-статус + машинный `code` (`LOGIN_TAKEN`, `INVITE_INVALID`, `QUOTA_EXCEEDED`, `NOT_IN_SUBTREE`, `BAD_CREDENTIALS`, `ACCOUNT_BANNED`, …). Стектрейсы наружу не уходят.

## Логирование
- `nestjs-pino`, структурный JSON, `request-id` на запрос. **Redact** тел с секретами (`password`, `answer`, `token`).

## Безопасность
- Хеш-сервис `argon2id` (общий для пароля и `answer_hash`) в `infrastructure` ([ADR-0009](./decisions/0009-server-side-hashing.md)). Плейнтекст приходит по HTTPS.
- Access — JWT (`ACCESS_TTL`), stateless. Refresh — в таблице `sessions` ([ADR-0018](./decisions/0018-refresh-tokens-sessions.md)), ротация, детект повторного использования → отзыв всех сессий.
- `AuthGuard` читает `Bearer`, проверяет вход разрешён: не `deleted`, не `deactivated`, не забанен (`EXISTS active ban`).
- Refresh — в httpOnly+Secure+SameSite cookie ([ADR-0020](./decisions/0020-api-conventions.md)); CSRF: SameSite + проверка origin на мутациях.
- `@nestjs/throttler` по IP на `auth/login|register`, `recovery/*`, `invites/check`.

## DI и слои
- Доступ к данным — только `adapters` → `repositories`. `use-cases`/`domain-services` не импортируют Drizzle. Привязка реализаций через DI-токены (Symbol/строка), напр. `ACCOUNT_ADAPTER`.
- Кросс-доменные вызовы: `use-case` зовёт `domain-service` чужой области (слой ниже), не её `use-case` ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)).

## Транзакции
- Регистрация по коду, погашение/отзыв инвайта — в **одной транзакции** (Drizzle transaction): консистентность `accounts` + `invitations` + `invite_codes` + счётчика ([ADR-0013](./decisions/0013-invites-lifecycle-cleanup.md), [ADR-0007](./decisions/0007-invite-quota-counter.md)).

## Миграции
- Только явные миграции через **drizzle-kit**; auto-push в проде запрещён. Схемы — `system/orm-schemas`, связи — `system/orm-relations`.

## Тесты
- Unit (Jest) на use-cases с замоканными портами — основная масса.
- e2e (supertest) на ключевые сценарии (регистрация в обоих режимах, login/ban/recovery) на тестовой БД.

## Фоновые задачи
- Sweep истёкших `invite_codes` (по `expires_at`) через `@nestjs/schedule`. (Логи безопасности не ведём — [ADR-0032](./decisions/0032-phase1-refinements.md).)
