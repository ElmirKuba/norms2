# ADR-0011: Таблица `accounts` (с паролем), переименование `users`, `updated_at` везде

- **Статус:** accepted
- **Дата:** 2026-05-29
- **Решает:** Elmir (пункты D1, E1)
- **Контекст-теги:** [domain] [db]
- **Заменяет:** часть [ADR-0005](./0005-user-split-entities.md) (таблица `credentials` как отдельная — теперь слита в `accounts`). Раздельность `secret_qa` — остаётся (она 1:N).

## Контекст
По [ADR-0005](./0005-user-split-entities.md) пароль жил в отдельной таблице `credentials`. Elmir решил хранить пароль в строке аккаунта и переименовать `users` → `accounts`.

## Решение
- **`users` → `accounts`** — каноническое имя главной таблицы. Где ранние ADR пишут `users`, читать `accounts`.
- **`password_hash` — колонка в `accounts`** (argon2id, [ADR-0009](./0009-server-side-hashing.md)). Таблицы `credentials` нет.
- `secret_qa` остаётся отдельной таблицей 1:N к `accounts` ([ADR-0008](./0008-account-recovery-secret-questions.md)).
- **`created_at` + `updated_at` на всех таблицах.** `updated_at` автообновляется при изменении строки (триггер БД или ORM-хук — выбор в `backend.md`). `security_logs` append-only — там `updated_at == created_at`, оставлен для единообразия.

Колонки `accounts` (фаза 1): `id`, `login` (uniq, case-insensitive), `alias`, `password_hash`, `inviter_id` (FK→accounts, null), `invite_reason` (null — [ADR-0013](./0013-invites-lifecycle-cleanup.md)), `invited_at` (null), `registration_source` (free|invite|seed — [ADR-0010](./0010-registration-auth-flow.md)), `invites_remaining` (int=3 — [ADR-0007](./0007-invite-quota-counter.md)), `recovery_required_count` (null — [ADR-0008](./0008-account-recovery-secret-questions.md)), `created_at`, `updated_at`.
**Нет колонки статуса** — «забанен» вычисляется из `bans` ([ADR-0012](./0012-bans-derived-status.md)). Статус `deleted/deactivated` — открытый пункт D8.

## Альтернативы
- Отдельная `credentials` (ADR-0005) — для 1:1-пароля даёт лишний JOIN; Elmir выбрал слияние. Изоляция секретов теперь — на уровне «не отдавать `password_hash` в DTO».

## Последствия
- `database.md`, `domain-model.md`: таблица/агрегат `accounts`; `password_hash` — колонка; `secret_qa` отдельно.
- Все будущие доки используют `accounts`, не `users`.
- Тип PK (uuid vs bigint), snake_case — всё ещё открытый E1 (здесь решены только timestamps и имя главной таблицы).
