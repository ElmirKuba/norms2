# backend.md — правила работы в `nest/`

> Реализация бэкенда. Архитектура/слои — [`architecture.md`](./architecture.md). Конвенции — [ADR-0019](./decisions/0019-backend-architecture-conventions.md), [ADR-0020](./decisions/0020-api-conventions.md). Тулинг — [ADR-0021](./decisions/0021-tooling-defaults.md). Домен — [`domain-model.md`](./domain-model.md). Схема — [`database.md`](./database.md).

## Стек
NestJS (≥10), TypeScript **strict** (без `any` — `unknown` + сужение), TypeORM (явные миграции), PostgreSQL, pnpm. Зависимости: `@nestjs/config`, `zod`, `nestjs-zod`, `@nestjs/throttler`, `nestjs-pino`, `argon2`, `@nestjs/jwt`, `cookie-parser`.

## Структура модуля (per feature)
```
modules/<feature>/
├─ domain/          # сущности, VO, доменные сервисы (без @nestjs/*, без typeorm)
├─ application/     # use-cases + порты (интерфейсы репозиториев)
├─ infrastructure/  # TypeORM-репозитории (реализации портов), хеш-сервис, адаптеры
├─ interface/       # controllers, DTO (zod), guards
└─ <feature>.module.ts
```
`app.module.ts`/`main.ts` — только bootstrap, без бизнес-логики.

## Конфигурация
- `zod`-схема всех ENV; валидация при старте (**fail-fast** — нет валидного env → не поднимаемся).
- В коде только `ConfigService`, никогда `process.env`.
- ENV (см. также `deployment.md`): `FREE_REGISTRATION`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TTL` (~15m), `REFRESH_TTL` (~30d), `DB_*`, `INVITE_DEFAULT_QUOTA`=3, `INVITE_TTL_DAYS`=3, `SECURITY_LOG_TTL_DAYS`=60, `COOKIE_SECURE` (true в проде).

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

## DI и порты
- Порты репозиториев — интерфейсы в `application/`; реализации в `infrastructure/`. Привязка через DI-токены (Symbol/строка), напр. `ACCOUNT_REPOSITORY`. Use-cases зависят от токена-порта, не от TypeORM.

## Транзакции
- Регистрация по коду, погашение/отзыв инвайта — в **одной транзакции** (unit-of-work): консистентность `accounts` + `invitations` + `invite_codes` + счётчика ([ADR-0013](./decisions/0013-invites-lifecycle-cleanup.md), [ADR-0007](./decisions/0007-invite-quota-counter.md)).

## Миграции
- Только явные TypeORM-миграции; `synchronize` запрещён везде. Файлы `<timestamp>-<name>.ts`, обязательны `up`/`down`.

## Тесты
- Unit (Jest) на use-cases с замоканными портами — основная масса.
- e2e (supertest) на ключевые сценарии (регистрация в обоих режимах, login/ban/recovery) на тестовой БД.

## Фоновые задачи
- Sweep истёкших `invite_codes` (по `expires_at`) и `security_logs` (TTL 60д). Механизм (nest-schedule vs pg_cron) — пункт B3/E8 карты; по умолчанию `@nestjs/schedule`.
