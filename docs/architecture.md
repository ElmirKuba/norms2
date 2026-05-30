# architecture.md — архитектура бэкенда

> Источник истины по **слоям, модулям и потокам данных** бэкенда. Конвенции — [ADR-0019](./decisions/0019-backend-architecture-conventions.md). Домен/сущности — [`domain-model.md`](./domain-model.md). Схема БД — [`database.md`](./database.md).

## Монорепо

```
norms2/
├─ nest/        # backend (NestJS)
├─ angular/     # frontend (Angular SPA)
├─ docs/        # документация
└─ docker-compose.*.yml
```
У `nest/` и `angular/` — свои `package.json` и `.gitignore`.

## Слои (строго)

```
nest/src/modules/<feature>/
├─ domain/          # сущности, VO, доменные сервисы — БЕЗ @nestjs/* и typeorm
├─ application/     # use-cases + порты (интерфейсы репозиториев)
├─ infrastructure/  # адаптеры: TypeORM-репозитории, внешние API
└─ interface/       # NestJS controllers, DTO, guards
```

Правила зависимостей (внутрь, не наружу):
- `domain` не зависит ни от кого.
- `application` зависит только от `domain` и от **портов** (своих интерфейсов).
- `infrastructure` реализует порты, знает про TypeORM/PG.
- `interface` вызывает use-cases, маппит DTO ↔ домен.
- Замена ORM/БД = переписать только `infrastructure`, домен и application не трогаем.

## Shared kernel

`nest/src/shared/` — кросс-доменное: `Id` (VO формата `uuidv7___unixmillis`), `generateId()`, базовые ошибки, `Result`. Фичи импортят из `shared`, **не друг из друга** ([ADR-0019](./decisions/0019-backend-architecture-conventions.md) C4).

## Модули фазы 1

| Модуль | Отвечает за | Ключевые use-cases |
|---|---|---|
| `auth` | регистрация, вход, токены, восстановление | RegisterAccount, LoginAccount, Refresh/Logout, Recovery* |
| `accounts` | профиль, alias, жизненный цикл | GetMyProfile, GetProfileByLogin, UpdateMyAlias, Deactivate/Delete |
| `invites` | коды + дерево приглашений | CreateInvite, RevokeInvite, CheckInviteCode, ListMyInvitees |
| `bans` | баны в поддереве | BanInMySubtree, UnbanMyBan, ListMyBans |
| `sessions` | устройства/сессии | ListMySessions, RevokeSession, RevokeAllExceptCurrent |
| `shared` | примитивы, конфиг, ошибки, логи | — |

Межмодульно — только через порты/use-cases application-слоя ([ADR-0019](./decisions/0019-backend-architecture-conventions.md) C5).

## Сквозные механизмы

- **Конфиг:** `@nestjs/config` + zod-валидация ENV, fail-fast; в коде только `ConfigService`.
- **Ошибки:** единый конверт `{ error: { code, message, details? } }` через глобальный exception filter.
- **Логи:** pino (структурный JSON), `request-id`; тела с секретами не логируются.
- **Идемпотентность:** уникальные ограничения БД; операции безопасны к ретраю.
- **Идентификаторы:** `Id` VO, util `generateId()` (общий с фронтом).

## Поток данных (пример: регистрация по коду)

```
interface (controller + DTO)
   → application: RegisterAccount (use-case)
       → проверка квоты/кода через порты (InviteCodeRepository, AccountRepository)
       → транзакция: создать Account + Invitation, погасить код, удалить код
   → infrastructure: TypeORM-репозитории реализуют порты
   ← результат → DTO (без токенов) → редирект на вход
```

## Безопасность/приватность в архитектуре

- Плейнтекст-секреты только по TLS, хешируются в `infrastructure` хеш-сервисом (argon2id) ([ADR-0009](./decisions/0009-server-side-hashing.md)).
- `security_logs` — инфраструктурный лог без связи с доменом ([152fz — приватный]).
- Бан — производное состояние (`EXISTS active ban`), не флаг ([ADR-0012](./decisions/0012-bans-derived-status.md)).
