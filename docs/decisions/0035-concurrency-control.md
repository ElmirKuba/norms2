# ADR-0035: Контроль конкурентного доступа (optimistic lock + atomic SQL)

- Статус: accepted
- Дата: 2026-06-02
- Теги: [architecture] [backend] [db] [concurrency]
- Связано: [ADR-0011](./0011-accounts-table-merge-rename.md) (таймстампы), [ADR-0007](./0007-invite-quota-counter.md) (счётчик инвайтов), [ADR-0018](./0018-refresh-tokens-sessions.md) (сессии).

## Контекст

Параллельные писатели (несколько процессов/инстансов на одной БД) могут терять обновления (lost update). У нас есть `created_at`/`updated_at` на каждой таблице и транзакции на жизненном цикле инвайтов, но **версионирования/optimistic-lock нет**. Горячие точки фазы 1: правки профиля с разных устройств (`accounts`) и счётчик `invites_remaining` (read-modify-write `−=1` → двойная трата).

Принцип: защищаемся там, где гонка реальна; где пишем атомарным `UPDATE ... WHERE`, Postgres на READ COMMITTED сам не теряет обновления (второй UPDATE перечитывает строку после блокировки). `version` нужен только при read-modify-write **целого агрегата**.

## Решение

1. **`accounts.version`** — `bigint not null` (инкремент). Optimistic lock на правках профиля:
   `UPDATE accounts SET <колонки>, version = version + 1 WHERE id = :id AND version = :v`.
   `rowcount = 0` → конфликт.
2. **Retry** поверх optimistic lock: на конфликте — **reload свежей строки → наложить своё изменение поверх → повторный CAS-UPDATE**, до `OPTIMISTIC_RETRY_ATTEMPTS` (default **3**, в `.env`, zod-валидация). Разные колонки (alias vs login) → оба изменения сохраняются (merge на ретрае); одна колонка → осознанный last-wins. Исчерпали попытки → доменная ошибка `CONCURRENT_MODIFICATION` → HTTP **409**.
   - Слои: репозиторий делает **одну** CAS-попытку и сигналит конфликт (`VersionConflictError`); политику ретраев держит use-case (или хелпер `withOptimisticRetry(attempts, fn)` в `shared/utility-level`). Пессимистичных блокировок (`SELECT ... FOR UPDATE`) не держим.
3. **`accounts.invites_remaining`** — НЕ version: атомарный `UPDATE ... SET invites_remaining = invites_remaining - 1 WHERE id = :id AND invites_remaining > 0` + проверка rowcount (создать код можно только если списали).
4. **`sessions`** — ротация refresh через CAS по токену: `UPDATE sessions SET token_hash = :new, ... WHERE id = :id AND token_hash = :old RETURNING ...`; `rowcount = 0` → reuse-детект → отозвать все сессии аккаунта.
5. **`secret_qa` / `invite_codes` / `invitations` / `bans`** — version НЕ нужен: транзакции + `DELETE ... RETURNING` (погашение кода) + unique/partial-unique constraints (один активный бан на пару, уникальный `code`, 1:1 `invitations.account_id`).
6. **Изоляция** — дефолт Postgres **READ COMMITTED**; SERIALIZABLE глобально не включаем (лишние ретраи).

### Почему version-инкремент, а не unixtime-метка
Для много-инстансного сценария timestamp хуже: рассинхрон часов между нодами (версия может «уйти назад») + коллизии в пределах 1 мс (конфликт не поймается). Инкремент считает сама БД (`version + 1`) — монотонно, без коллизий, без зависимости от часов. «Когда изменено» уже есть — это `updated_at`; не нагружаем одну колонку двумя задачами.

## Альтернативы
- **`version` на всех мутабельных таблицах** — отвергнуто: церемония без нужды (счётчик/сессии закрываются атомарным SQL надёжнее).
- **Только транзакции/атомарный SQL, без `version`** — отвергнуто: не ловит lost-update на правках профиля (load-modify-save агрегата).
- **`version` как unixtime-метка** — отвергнуто: часы/коллизии (см. выше).

## Последствия
- `database.md`: в `accounts` добавлен `version bigint not null` (миграция S1).
- `backend.md`/`deployment.md`: ENV `OPTIMISTIC_RETRY_ATTEMPTS`=3; код ошибки `CONCURRENT_MODIFICATION` (409) в список.
- `.env.example` + `system/config/env.schema.ts`: ключ `OPTIMISTIC_RETRY_ATTEMPTS`.
- Реализация — при кодинге репозиториев/use-cases (A/R этапы): `withOptimisticRetry`, CAS-методы.
