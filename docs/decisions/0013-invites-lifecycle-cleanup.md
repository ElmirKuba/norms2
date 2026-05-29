# ADR-0013: Жизненный цикл инвайтов — таблица только живых кодов

- **Статус:** accepted
- **Дата:** 2026-05-29
- **Решает:** Elmir (уточнение к [ADR-0004](./0004-invite-quota-ttl.md) / [ADR-0007](./0007-invite-quota-counter.md))
- **Контекст-теги:** [domain] [db]
- **Поправка:** `code` — **не** PK. У таблицы суррогатный `id` PK (общая конвенция, все таблицы), а `code` — отдельная **уникальная** колонка.

## Контекст
Дерево «кто кого пригласил» живёт в `accounts.inviter_id` ([ADR-0002](./0002-invite-tree-adjacency.md)), квота — счётчик `invites_remaining` ([ADR-0007](./0007-invite-quota-counter.md)). Значит строки использованных кодов в `invites` избыточны и могут чиститься.

## Решение
Таблица `invites` хранит фактически только **живые (pending)** коды. Терминальные состояния удаляются после применения побочных эффектов:

- **Создание:** `invites_remaining −= 1`, вставка pending-кода (`code` — строка `XXXXXXXXXX` без дефисов, `reason`, `inviter_id`, `expires_at = now + INVITE_TTL_DAYS(3)`).
- **Использование** (регистрация по коду): в одной транзакции копируем `reason → accounts(приглашённый).invite_reason`, `invited_at = now`, ставим `inviter_id`, затем **строку кода удаляем**. Счётчик не меняется.
- **Отзыв** (только pending): `invites_remaining += 1`, строку удаляем.
- **Истечение** (TTL, неиспользован): слот **сгорает** (счётчик не меняется), строку чистит фоновый sweep.

Денормализация `invite_reason` + `invited_at` на строку приглашённого в `accounts` — чтобы профиль «кого пригласил: ник + причина + дата» работал без хранения использованных кодов.

## Альтернативы
- **Хранить все коды со `status` (used/revoked/expired)** — полный аудит, но таблица копит мёртвые строки; дерево и так в `accounts`. Отвергнут ради простоты по желанию Elmir.

## Последствия
- `database.md`: `invites(code PK, inviter_id FK, reason, expires_at, created_at, updated_at)` — без `used_by`/долгого `status`; sweep по `expires_at`.
- `accounts`: колонки `invite_reason` (null), `invited_at` (null) — заполняются при погашении кода; null у `free`/`seed`-корней.
- `domain-model.md`: «кого пригласил» = `accounts WHERE inviter_id = me` (с `invite_reason`/`invited_at`).
- Аудит использованных кодов не сохраняется (сознательно).
