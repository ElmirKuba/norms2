# ADR-0014: Ребро приглашения — отдельная таблица `invitations`

- **Статус:** accepted
- **Дата:** 2026-05-29
- **Решает:** Elmir (пункты D2/E4)
- **Контекст-теги:** [domain] [db]
- **Заменяет:** физическое хранение дерева из [ADR-0002](./0002-invite-tree-adjacency.md) (колонка `inviter_id` в accounts → отдельная таблица) и денормализацию `invite_reason`/`invited_at` на accounts из [ADR-0013](./0013-invites-lifecycle-cleanup.md). **Порт `InviteTreeRepository` из ADR-0002 — в силе.**

## Контекст
Колонка `inviter_id` + `invite_reason`/`invited_at` в `accounts` смешивали отношение «кто меня пригласил» с самим аккаунтом. Пароль — атрибут аккаунта; приглашение — отношение, ему место в отдельной таблице.

## Решение
Таблица **`invitations`** — реализованное ребро дерева:
- `id` PK, `account_id` FK→accounts (**UNIQUE** — приглашённый), `inviter_id` FK→accounts (пригласивший), `reason`, `invited_at`, `created_at`, `updated_at`.
- Из `accounts` убраны `inviter_id`, `invite_reason`, `invited_at`.
- Корни (`registration_source = free|seed`) строки в `invitations` не имеют. `registration_source` остаётся на `accounts`.

**Кардинальности:** `accounts` ↔ `invitations` — **1:1** (0..1, через `UNIQUE account_id`); `invitations.inviter_id` → `accounts` — **1:N**.

**Дерево/баны:** `isAncestor`/поддерево — рекурсивный CTE по `invitations`. Скрыто за портом `InviteTreeRepository` ([ADR-0002](./0002-invite-tree-adjacency.md)) — домен не зависит от физической раскладки.

**Профиль «кого пригласил»:** `SELECT … FROM invitations WHERE inviter_id = me` + join accounts за `alias`. Денормализация на accounts больше не нужна.

**Наименование:** таблицу кодов `invites` переименовать в `invite_codes` (чтобы не путать с `invitations`).

## Альтернативы
- **Adjacency-колонка в accounts** (ADR-0002) — меньше таблиц, без JOIN, но смешивает отношение с аккаунтом. Отвергнут по желанию Elmir ради чистоты модели.

## Последствия
- Таблиц снова 6: `accounts`, `secret_qa`, `invite_codes`, `invitations`, `bans`, `security_logs`.
- `database.md`/`domain-model.md`: `invitations` как отдельная сущность-ребро; `accounts` без invite-полей.
- Появляется единственная 1:1-связь в схеме (`accounts`↔`invitations`).
- Реализация порта `InviteTreeRepository` — поверх `invitations`.
