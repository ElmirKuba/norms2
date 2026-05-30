# domain-model.md — доменная модель фазы 1

> Источник истины по **доменному слою** (сущности, value objects, инварианты, порты, use-cases). Физическая схема — [`database.md`](./database.md). Границы слоёв — `architecture.md`. «Почему» — [`decisions/`](./decisions/README.md).
>
> Домен **не импортирует** `@nestjs/*` и `typeorm`. Работает с **портами** (интерфейсами репозиториев); реализации — в `infrastructure/`. ([CLAUDE.md](../CLAUDE.md))

## Value objects

- **`Id`** — строка `uuidv7___unixmillis`; валидирует формат, не «голая строка» в домене. ([ADR-0016](./decisions/0016-primary-key-format.md))
- **`Login`** — `^[a-zA-Z0-9_]{3,32}$`; равенство регистронезависимое; не из зарезервированного списка (`admin`,`root`,`moderator`,`mod`,`support`,`system`,`normis`,`normisy`,`null`,`me`). ([ADR-0006](./decisions/0006-registration-field-rules.md))
- **`Alias`** — 2–32, Unicode-буквы/цифры/пробел/дефис; trim + схлоп пробелов.
- **`SecretAnswer`** — нормализация (trim+lower+схлоп) перед хешированием.
- **`InviteCodeValue`** — 10 символов без дефисов; визуальное форматирование — на фронте.

## Сущности и инварианты

### `Account` (корень)
Поля (доменный вид): `id`, `login: Login`, `alias: Alias`, `passwordHash`, `registrationSource: free|invite|seed`, `invitesRemaining`, `recoveryRequiredCount?`, `timezone` (IANA, default UTC — [ADR-0028](./decisions/0028-accent-timezone-and-domains.md)), `deactivatedAt?`, `deletedAt?`.
Инварианты:
- `invitesRemaining ≥ 0`; создать код можно только при `> 0`. ([ADR-0007](./decisions/0007-invite-quota-counter.md))
- **Вход разрешён ⇔** `deletedAt == null` И `deactivatedAt == null` И не забанен. ([ADR-0017](./decisions/0017-account-soft-delete.md), [ADR-0012](./decisions/0012-bans-derived-status.md))
- Секреты (`passwordHash`) не попадают в DTO профиля.

### `SecretQuestion` (N на аккаунт)
`id`, `accountId`, `question`, `answerHash`. Свой вопрос валидируется чёрным списком тем. ([ADR-0008](./decisions/0008-account-recovery-secret-questions.md))

### `InviteCode` (живой код)
`id`, `code`, `inviterId`, `reason`, `expiresAt`. Валиден для погашения ⇔ существует (pending) И `expiresAt > now`.

### `Invitation` (ребро дерева)
`id`, `accountId` (приглашённый, уникален), `inviterId`, `reason`, `invitedAt`. Определяет иерархию приглашений. ([ADR-0014](./decisions/0014-invitation-edge-table.md))

### `Ban`
`id`, `bannerId`, `targetId`, `reason`, `active`. Инвариант создания: `isAncestor(bannerId, targetId)`. Снять можно только свою запись. ([ADR-0003](./decisions/0003-ban-semantics.md))

### `Session`
`id`, `accountId`, `tokenHash`, `userAgent?`, `expiresAt`, `revokedAt?`. ([ADR-0018](./decisions/0018-refresh-tokens-sessions.md))

> `security_logs` — инфраструктурный лог, не доменная сущность; живёт в infrastructure, без связи с доменом. ([152fz.md](./152fz.md))

## Порты (интерфейсы репозиториев, в `application/`)

- `AccountRepository` — CRUD + поиск по `lower(login)`; дефолтный scope исключает `deletedAt != null`.
- `SecretQARepository` — вопросы аккаунта.
- `InviteCodeRepository` — живые коды; count/проверка квоты.
- `InviteTreeRepository` — `isAncestor(x,y)`, `listSubtree(x)`, `listChildren(x)`, `getInviter(x)` поверх `invitations` (рекурсивный CTE; реализация скрыта). ([ADR-0002](./decisions/0002-invite-tree-adjacency.md))
- `BanRepository` — активные баны по target; запись/деактивация своей.
- `SessionRepository` — создание/ротация/отзыв/листинг.

## Use-cases (в `application/`)

**Регистрация/вход** ([ADR-0010](./decisions/0010-registration-auth-flow.md)):
- `RegisterAccount(alias, login, password, inviteCode?)` — режим по `FREE_REGISTRATION`. Free → корень (`source=free`). Invite → транзакция: проверить+погасить код, создать `Invitation`, `source=invite`. **Токены не выдаёт.**
- `CheckInviteCode(code)` — совещательная проверка валидности.
- `LoginAccount(login, password)` — проверка входа (не удалён/деактивирован/забанен) → выдать access (JWT) + refresh (создать `Session`).
- `RefreshSession`, `Logout`, `ListMySessions`, `RevokeSession(id)`, `RevokeAllSessionsExceptCurrent`.

**Восстановление** ([ADR-0008](./decisions/0008-account-recovery-secret-questions.md)):
- `AddSecretQuestion`, `RemoveSecretQuestion`, `SetRecoveryRequiredCount(K)`.
- `StartRecovery(login)` → вернуть K случайных вопросов. `CompleteRecovery(login, answers[], newPassword)` → сверить все K → сменить пароль.

**Приглашения** ([ADR-0007](./decisions/0007-invite-quota-counter.md), [ADR-0013](./decisions/0013-invites-lifecycle-cleanup.md)):
- `CreateInvite(reason)` — `invitesRemaining>0` → `−1`, создать код. `RevokeInvite(id)` — pending → `+1`, удалить. `ListMyInvitees` = `invitations WHERE inviterId=me` (+ alias, reason, invitedAt).

**Баны** ([ADR-0003](./decisions/0003-ban-semantics.md), [ADR-0012](./decisions/0012-bans-derived-status.md)):
- `BanInMySubtree(targetId, reason)` — проверить `isAncestor`. `UnbanMyBan(targetId)`. `ListMyBans`.

**Профиль:**
- `GetMyProfile` (self-view: login, alias, дата, кто пригласил, кого пригласил, статус). `GetProfileByLogin` (public: alias, login, дата). `UpdateMyAlias`.

**Жизненный цикл аккаунта** ([ADR-0017](./decisions/0017-account-soft-delete.md)):
- `DeactivateMyAccount`, `ReactivateMyAccount`, `DeleteMyAccount` (soft).
