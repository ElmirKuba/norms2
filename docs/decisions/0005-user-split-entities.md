# ADR-0005: Доменная модель пользователя — раздельные сущности User / Credentials / SecretQA

- **Статус:** accepted — **кардинальность `SecretQA` (была 1:1) заменена [ADR-0008](./0008-account-recovery-secret-questions.md)** (теперь 1:N, в настройках). Раздельность сущностей User/Credentials/SecretQA — в силе.
- **Дата:** 2026-05-29
- **Решает:** Elmir + ToT в [`../archive/decision-map.md`](../archive/decision-map.md) (пункт D1)
- **Контекст-теги:** [domain] [db]

## Контекст
У пользователя в фазе 1 есть публичная идентичность (login, alias, статус, место в дереве) и секреты (хеш пароля, секретный вопрос/ответ). Вопрос — держать всё в одной сущности или разделить.

## Решение
Три **раздельные сущности**, каждая со своей таблицей и своим репозиторий-портом:

- **`User`** (идентичность): `id`, `login` (уник.), `alias`, `status` (active/banned), `inviter_id` (nullable, self-FK — [ADR-0002](./0002-invite-tree-adjacency.md)), `created_at`, `invite_quota_override` (nullable — [ADR-0004](./0004-invite-quota-ttl.md)).
- **`Credentials`** (секрет входа): `user_id` (PK = FK 1:1), `password_hash` + параметры алгоритма.
- **`SecretQA`** (восстановление): `user_id` (PK = FK 1:1), `question`, `answer_hash`. Инвариант: `question` не из чёрного списка тем (см. пункт B2, пересекается с [ADR-0001](./0001-data-minimization-no-pii.md)).

Связи — строго 1:1. Регистрация создаёт все три записи в **одной транзакции** (unit-of-work), чтобы не было пользователя без credentials.

## Альтернативы
- **Единая сущность `User`** — проще, но мешает секреты с публичной идентичностью, меньше изоляции. Отвергнут.
- **Агрегат `User` + value objects** — чистый DDD, но Elmir выбрал явное разделение на уровне сущностей и таблиц ради изоляции секретов. Отвергнут в пользу раздельных сущностей.

## Последствия
- `domain-model.md`: три сущности с явными границами; секреты не утекают в DTO профиля (профиль отдаёт только из `User`).
- `database.md`: таблицы `users`, `credentials`, `secret_qa`; `credentials`/`secret_qa` ссылаются на `users.id` как PK=FK. Изоляция позволяет в будущем ужесточить доступ/шифрование секретных таблиц без касания `User` (escape-hatch, как в [ADR-0002](./0002-invite-tree-adjacency.md)).
- `backend.md`: отдельные порты `UserRepository`, `CredentialsRepository`, `SecretQARepository`; use-case `RegisterUser` оркестрирует их в одной транзакции.
- Профиль (public/self view) читает только из `User` — секреты физически в других таблицах, случайно не отдашь.
