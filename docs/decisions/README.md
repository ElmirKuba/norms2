# docs/decisions/ — журнал архитектурных решений (ADR)

> Каждое значимое и трудно-обратимое решение фиксируется здесь отдельным файлом.
> Цель — чтобы через полгода было понятно **почему** так, а не «кто-то так сделал».

## Зачем ADR

`todo.md` копит вопросы «которые нужно принять». Как только вопрос **решён** — ответ переезжает сюда отдельным ADR, а строка в `todo.md` помечается `[x]` со ссылкой на номер ADR. Так решение не растворяется в переписке.

Связь с [`152fz.md`](../152fz.md): любое поле/механика, потенциально являющаяся ПДн, оформляется отдельным ADR с тегом `[152fz]` ещё до кода.

## Жизненный цикл этой папки (важно)

ADR и [`decision-map.md`](../decision-map.md) — это **строительные леса фазы решений**, а не финальный спек для реализации. Цель проекта — дока, по которой **Sonnet реализует фазу 1 без вопросов и багов**. Поэтому:

1. **Сейчас** (фаза решений): принимаем решения, пишем ADR, двигаем `decision-map`. Тут допустимы supersede-цепочки (ADR-0002→0014 и т.п.) — это история выбора.
2. **Потом** (консолидация): все принятые решения сводятся в **чистые reference-доки** (`database.md`, `domain-model.md`, `api-contracts.md`, `backend.md`, `frontend.md`, `ui-ux.md`, `deployment.md`, `getting-started.md`) — только актуальное «что строим», **без** замещённых вариантов и противоречий. Это и есть спек для Sonnet.
3. **После консолидации:** `decision-map` (когда пуст) — в архив; ADR — схлопнуть в один тонкий журнал «почему так» (или убрать из пути реализации), чтобы Sonnet не спотыкался о замещённые решения. Рациональ сохраняем (чтобы не пере-решать), но вне implementation-поверхности.

Леса снимаем только когда стена (reference-доки) стоит и непротиворечива.

## Формат

Файл: `NNNN-kebab-короткое-название.md`, где `NNNN` — сквозной номер (`0001`, `0002`, …).

```markdown
# ADR-NNNN: <заголовок>

- **Статус:** proposed | accepted | superseded by ADR-XXXX | rejected
- **Дата:** YYYY-MM-DD
- **Решает:** Elmir (+ ресёрч, если был)
- **Контекст-теги:** [152fz] [backend] [db] …

## Контекст
Что за проблема, какие ограничения, что заставило выбирать.

## Решение
Что выбрали — одним абзацем, утвердительно.

## Альтернативы
Что рассматривали и почему отвергли.

## Последствия
Что теперь придётся/нельзя делать. Какие docs обновить.
```

Правила: ADR **неизменяем** после `accepted`. Передумали — заводим новый ADR со статусом, заменяющим старый (`superseded by ADR-XXXX`), а старому ставим тот же маркер. Историю не переписываем.

## Индекс

| # | Решение | Статус | Теги |
|---|---|---|---|
| [0001](./0001-data-minimization-no-pii.md) | Минимизация ПДн: только `login` + `alias` + `password` | accepted | [152fz] |
| [0002](./0002-invite-tree-adjacency.md) | Дерево приглашений: adjacency list + recursive CTE за портом | accepted | [domain] [db] |
| [0003](./0003-ban-semantics.md) | Семантика бана: запись банившего, OR-эффект, без каскада, только свой бан | accepted | [domain] |
| [0004](./0004-invite-quota-ttl.md) | Инвайты: состояния, квота (3 из ENV + override), TTL 3д, отзыв | accepted | [domain] [db] [backend] |
| [0005](./0005-user-split-entities.md) | Пользователь: раздельные сущности User / Credentials / SecretQA | accepted | [domain] [db] |
| [0006](./0006-registration-field-rules.md) | Правила полей: alias, login, чёрный список тем | accepted (QA-часть → ADR-0008) | [domain] [152fz] |
| [0007](./0007-invite-quota-counter.md) | Квота инвайтов: явный счётчик, лимит 3 за жизнь | accepted | [domain] [db] |
| [0008](./0008-account-recovery-secret-questions.md) | Восстановление: вопросы в настройках, 1:N, K-of-N | accepted | [domain] [db] [152fz] |
| [0009](./0009-server-side-hashing.md) | Хеширование на бэке, плейнтекст по TLS (на первое время) | accepted | [backend] [security] |
| [0010](./0010-registration-auth-flow.md) | Флоу рег/входа, feature-flags, invite-эндпоинты, без токенов на рег | accepted | [interface] [api] [frontend] |
| [0011](./0011-accounts-table-merge-rename.md) | `accounts` (с паролем), переименование users, updated_at везде | accepted | [domain] [db] |
| [0012](./0012-bans-derived-status.md) | Баны: отдельная таблица, статус производный (без флага в accounts) | accepted | [domain] [db] |
| [0013](./0013-invites-lifecycle-cleanup.md) | Инвайты: таблица только живых кодов, used→clean, истёкший слот сгорает | accepted (денорм на accounts → ADR-0014) | [domain] [db] |
| [0014](./0014-invitation-edge-table.md) | Ребро приглашения в отдельной таблице `invitations` (1:1 к accounts) | accepted | [domain] [db] |
| [0015](./0015-keep-invitations-and-bans-separate.md) | `invitations` и `bans` — раздельны (слияние отвергнуто) | accepted | [domain] [db] |
| [0016](./0016-primary-key-format.md) | **Сквозная конвенция:** id = строка `uuidv7___unixmillis`, util на be+fe | accepted | [db] [domain] |
| [0017](./0017-account-soft-delete.md) | Аккаунт: soft-delete (`deleted_at`) + деактивация, в фазе 1 | accepted | [domain] [db] |
| [0018](./0018-refresh-tokens-sessions.md) | Refresh-токены/сессии в Postgres, управление устройствами | accepted | [backend] [db] [security] |

### Ожидают решения (заглушки появятся при принятии)

Перенесены из [`../../todo.md` §«Решения»](../../todo.md):

| Вопрос | Кто решает |
|---|---|
| VPS-провайдер вне РФ | Elmir |
| Backup-домен (`.com`/`.app`/`.io`) | Elmir |
| nginx или Traefik для reverse-proxy | по итогам пробного деплоя |
| Модель хранения дерева приглашений + семантика бана в поддереве (C2) | Elmir + ресёрч |
| Механизм восстановления пароля (secret QA vs recovery-код) (C4) | Elmir |
| Logout: стор refresh-токенов (C1) | Elmir |
| Лимиты на приглашения (C3) | Elmir |
| Когда и как добавлять опциональный email | отложено |
