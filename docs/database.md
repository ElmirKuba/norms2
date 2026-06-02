# database.md — схема БД фазы 1

> Источник истины по **физической схеме**. Описывает «что есть», без истории решений. «Почему так» — в [`decisions/`](./decisions/README.md) (ссылки по тексту).
> Реализация: PostgreSQL + **Drizzle** с **явными миграциями** (drizzle-kit; auto-push в проде запрещён) — [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md). Слой `repositories` инкапсулирует ORM — бизнес-слои про неё не знают. Схема таблиц ниже от ORM не зависит.

## Конвенции (применяются ко всем таблицам)

- **PK `id`** — `varchar(52)`, формат `uuidv7___unixmillis` (пример `019e7488-0147-7305-9b95-a553f2d00c8e___1780071500548`). Генерация — util `generateId()` на бэке/фронте. Все FK — тоже `varchar(52)`. ([ADR-0016](./decisions/0016-primary-key-format.md))
- **Имена** — `snake_case` для таблиц и колонок; Drizzle-схемы (`system/orm-schemas`) маппят на camelCase в коде.
- **Таймстампы** — `created_at` и `updated_at` (`timestamptz not null`) на **каждой** таблице; `updated_at` автообновляется. ([ADR-0011](./decisions/0011-accounts-table-merge-rename.md))
- **Soft-delete** — аккаунты физически не удаляются; FK на `accounts` — `ON DELETE RESTRICT` (удаления строки не происходит). ([ADR-0017](./decisions/0017-account-soft-delete.md))
- **Хеши** — `password_hash` (пароль 3–64, [ADR-0032](./decisions/0032-phase1-refinements.md)), `answer_hash`, `token_hash` хранят argon2id-хеши (плейнтекст приходит по TLS, хешируется на бэке). ([ADR-0009](./decisions/0009-server-side-hashing.md))

## Таблицы (6)
> security_logs убрана ([ADR-0032](./decisions/0032-phase1-refinements.md)): логи безопасности в фазе 1 не ведём.

### 1. `accounts` — аккаунт (идентичность + вход + квота)
([ADR-0005](./decisions/0005-user-split-entities.md) с правкой [ADR-0011](./decisions/0011-accounts-table-merge-rename.md))

| Колонка | Тип | Ограничения |
|---|---|---|
| `id` | varchar(52) | PK |
| `login` | varchar(32) | `^[a-zA-Z0-9_]{3,32}$`; **уникальность по `lower(login)`**, глобальная ([ADR-0006](./decisions/0006-registration-field-rules.md), [ADR-0017](./decisions/0017-account-soft-delete.md)) |
| `alias` | varchar(32) | 3–32, Unicode; **не уникален** (один alias у разных людей допустим; уникален только `login`) ([ADR-0032](./decisions/0032-phase1-refinements.md)) |
| `avatar` | varchar | null; путь `content/avatars/<id>.<ext>` — аватар в MVP ([ADR-0031](./decisions/0031-file-storage-uploads.md), [ADR-0032](./decisions/0032-phase1-refinements.md)) |
| `password_hash` | text | argon2id |
| `registration_source` | varchar(8) | CHECK in (`free`,`invite`,`seed`) ([ADR-0010](./decisions/0010-registration-auth-flow.md)) |
| `invites_remaining` | int | not null, default из ENV `INVITE_DEFAULT_QUOTA`=3 ([ADR-0007](./decisions/0007-invite-quota-counter.md)) |
| `recovery_required_count` | int | null; K вопросов при восстановлении ([ADR-0008](./decisions/0008-account-recovery-secret-questions.md)) |
| `timezone` | varchar(64) | not null default `'UTC'`; IANA TZ пользователя (для ролловера/серий разделов) ([ADR-0028](./decisions/0028-accent-timezone-and-domains.md)) |
| `deactivated_at` | timestamptz | null; обратимая деактивация ([ADR-0017](./decisions/0017-account-soft-delete.md)) |
| `deleted_at` | timestamptz | null; soft-delete (скрыт из дефолтного scope) |
| `created_at`,`updated_at` | timestamptz | not null |

Индексы: `UNIQUE (lower(login))`. **Нет** колонки статуса бана (бан — производный, см. `bans`); **нет** `inviter_id` (см. `invitations`).

### 2. `secret_qa` — вопросы восстановления (1:N к `accounts`)
([ADR-0008](./decisions/0008-account-recovery-secret-questions.md))

| Колонка | Тип | Ограничения |
|---|---|---|
| `id` | varchar(52) | PK |
| `account_id` | varchar(52) | FK→accounts(id), ON DELETE RESTRICT |
| `question` | text | из безопасного списка ИЛИ свой (валидация чёрного списка тем — [ADR-0006](./decisions/0006-registration-field-rules.md)) |
| `answer_hash` | text | argon2id (ответ нормализован: trim+lower+схлоп пробелов) |
| `created_at`,`updated_at` | timestamptz | not null |

Индекс: `(account_id)`.

### 3. `invite_codes` — живые коды приглашений (N:1 создатель)
([ADR-0004](./decisions/0004-invite-quota-ttl.md), [ADR-0013](./decisions/0013-invites-lifecycle-cleanup.md))

| Колонка | Тип | Ограничения |
|---|---|---|
| `id` | varchar(52) | PK |
| `code` | varchar(10) | **UNIQUE**; строка `XXXXXXXXXX` без дефисов (формат `XXXX-XXXX-XX` — только визуально на фронте) |
| `inviter_id` | varchar(52) | FK→accounts(id), ON DELETE RESTRICT |
| `reason` | text | причина приглашения (предупреждение про ПДн в UI) |
| `expires_at` | timestamptz | `created_at + INVITE_TTL_DAYS`(=3) |
| `created_at`,`updated_at` | timestamptz | not null |

Хранит только **pending**-коды. `used`/`revoked`/`expired` строки удаляются после применения эффектов (см. жизненный цикл ниже). Индексы: `UNIQUE(code)`, `(inviter_id)`.

### 4. `invitations` — реализованное ребро дерева (1:1 к `accounts`)
([ADR-0014](./decisions/0014-invitation-edge-table.md); порт `InviteTreeRepository` — [ADR-0002](./decisions/0002-invite-tree-adjacency.md))

| Колонка | Тип | Ограничения |
|---|---|---|
| `id` | varchar(52) | PK |
| `account_id` | varchar(52) | FK→accounts(id), **UNIQUE** (приглашённый) → связь 1:1 |
| `inviter_id` | varchar(52) | FK→accounts(id) (пригласивший) |
| `reason` | text | копия из кода при погашении |
| `invited_at` | timestamptz | момент погашения |
| `created_at`,`updated_at` | timestamptz | not null |

У корней (`registration_source` = `free`/`seed`) строки нет. Дерево/`isAncestor` — рекурсивный CTE по этой таблице. Индексы: `UNIQUE(account_id)`, `(inviter_id)`.

### 5. `bans` — баны (N:1 банивший, N:1 цель)
([ADR-0003](./decisions/0003-ban-semantics.md), [ADR-0012](./decisions/0012-bans-derived-status.md))

| Колонка | Тип | Ограничения |
|---|---|---|
| `id` | varchar(52) | PK |
| `banner_id` | varchar(52) | FK→accounts(id); инвариант `isAncestor(banner, target)` |
| `target_id` | varchar(52) | FK→accounts(id) |
| `reason` | text | предупреждение про ПДн в UI |
| `active` | boolean | not null default true |
| `created_at`,`updated_at` | timestamptz | not null |

«Забанен» = `EXISTS(bans WHERE target_id=acc AND active)`. Снять можно только свою запись. Индексы: `(target_id, active)` (login-чек), partial `UNIQUE(banner_id, target_id) WHERE active`.

### 6. `sessions` — refresh-токены/устройства (N:1 к `accounts`)
([ADR-0018](./decisions/0018-refresh-tokens-sessions.md))

| Колонка | Тип | Ограничения |
|---|---|---|
| `id` | varchar(52) | PK |
| `account_id` | varchar(52) | FK→accounts(id), ON DELETE RESTRICT |
| `token_hash` | text | хеш refresh-токена |
| `user_agent` | text | null; опознание устройства в списке сессий |
| `expires_at` | timestamptz | срок refresh |
| `revoked_at` | timestamptz | null; отзыв (logout / kick / ротация) |
| `created_at`,`updated_at` | timestamptz | not null (`updated_at` ≈ last-used) |

Access-токен — stateless JWT, **не хранится**. Индексы: `(account_id)`, `(token_hash)`.

> **Платформенное расширение (введено в Фазе 3, [ADR-0029](./decisions/0029-novaskil-phase3-core.md)):** таблицы `roles` и `account_roles` (N:M аккаунт↔роль, роли `admin`/`user`) — общие для площадки, не только НоваСкил. Схема — в [`sections/novaskil/domain-model.md`](./sections/novaskil/domain-model.md). Разделы Акцент/НоваСкил добавляют свои таблицы в эту же БД (рядом).

> ~~7. security_logs~~ — **убрана** ([ADR-0032](./decisions/0032-phase1-refinements.md)): логи безопасности в фазе 1 не ведём (меньше данных = лучше для 152-ФЗ). Rate-limit работает без персистентного следа. Можно вернуть волной.

## Связи (ER)

```
accounts ──1:1── invitations.account_id   (UNIQUE; ребро дерева)
accounts ──1:N── invitations.inviter_id
accounts ──1:N── secret_qa.account_id
accounts ──1:N── invite_codes.inviter_id
accounts ──1:N── bans.banner_id
accounts ──1:N── bans.target_id
accounts ──1:N── sessions.account_id
```

Единственная 1:1 — `accounts`↔`invitations`. Все FK ссылаются на `accounts.id`. `accounts` ни на кого не ссылается.

## Жизненный цикл `invite_codes` → `invitations`

- **Создать код:** `accounts.invites_remaining −= 1`; insert pending в `invite_codes`.
- **Погасить** (регистрация по коду, одна транзакция): insert в `invitations` (`account_id`=новый, `inviter_id`=создатель, `reason`/`invited_at`); **delete** строки кода. Счётчик не меняется.
- **Отозвать** (только pending): `invites_remaining += 1`; delete кода.
- **Истечь** (TTL): слот **сгорает** (счётчик не меняется); sweep удаляет код.

## Политика миграций

- Только явные миграции через **drizzle-kit**; auto-push в проде запрещён ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)).
- Нейминг: `<timestamp>-<name>.ts`; обязательны `up` и `down`.
- Прогон в проде — отдельным шагом деплоя (детали — `deployment.md`).

## ENV, влияющие на схему/данные

`INVITE_DEFAULT_QUOTA`=3, `INVITE_TTL_DAYS`=3, `FREE_REGISTRATION`, TTL логов 60д, дневная соль для `ip_hash`. Полный список — `deployment.md`.

## Открытые мелочи

- Точные TTL access/refresh — в `backend.md`.
- Расширения PG (pgcrypto и т.п.) и механизм sweep (pg_cron vs nest-schedule) — пункты B3/E8 карты решений.
