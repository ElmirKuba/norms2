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

## Уточнение 2026-07-29 (фаза 2, патч 2.6.4) — конвенция `version`

Исходно (фаза 1) «`version` на всех мутабельных таблицах» отвергнуто как церемония: конкурировали
только вкладки одного браузера, а счётчики закрывались атомарным SQL. **Контекст изменился** —
пользователь работает с телефона и десктопа одновременно, и стейл-клиент молча затирает чужую
запись (замерено на dev: повтор `complete` перезаписал `doneValue 100 → 60`). Поэтому:

1. **Тип — `integer not null default 0`** для всех новых таблиц. Переполнение нереально (2.1 млрд
   правок одной строки). `accounts.version bigint` — историческое исключение, не мигрируем.
2. **`version` заводим там, где выполняются все три условия:** строку правит человек; правка идёт
   через read-modify-write (загрузили → изменили → сохранили); потеря правки незаметна глазу.
   Практически: `tasks`, `micro_wins`, `milestones`, `goals`, `accent_settings`, `obstacles`/
   `counterplays` (2.7) — в дополнение к уже имеющим (`accounts`, `habits`, `anti_habits`).
3. **`version` НЕ заводим:** в append-only журналах (`goal_entries`, `micro_win_logs`,
   `anti_habit_events`, `notifications`, `session_token_history`) — там insert, нечего терять;
   в справочниках/сидах (`accent_domains`, `accent_attributes`); в служебных таблицах со своей
   атомарной логикой (`sessions`, `invite_codes`).
4. **Bump — в репозитории, а не в use-case:** каждый `UPDATE` строки делает `version = version + 1`
   в том же запросе. Так нельзя забыть при добавлении нового пути правки.
5. **Колонку заводим сразу, CAS-проверку включаем по надобности.** Наличие `version` в ответе API
   ничего не ломает; строгую проверку (`WHERE version = :expected` → `409`) включаем там, где гонка
   реальна — начиная с `tasks` (см. [ADR-0061](./0061-cross-device-data-freshness.md)).
6. **`updated_at` — отдельная колонка, не заменитель version** (у `tasks` её нет — завести вместе
   с `version`). Одна отвечает «когда», другая «сколько раз»; смешивать нельзя (см. выше).

Следствие для [ADR-0052](./0052-accent-goal-direction-and-computed-progress.md): пункт «`version`
для `goals` НЕ нужна, PATCH — last-write-wins (низкие ставки)» уточняется — **агрегаты
по-прежнему вычисляются на чтение** (это не отменяется), но сама строка цели получает `version`
ради предсказуемости кросс-девайс правок. Ставки действительно низкие, поэтому шаг необязательный
и идёт в общем миграционном проходе 2.6.4.

## Последствия
- `database.md`: в `accounts` добавлен `version bigint not null` (миграция S1).
- `backend.md`/`deployment.md`: ENV `OPTIMISTIC_RETRY_ATTEMPTS`=3; код ошибки `CONCURRENT_MODIFICATION` (409) в список.
- `.env.example` + `system/config/env.schema.ts`: ключ `OPTIMISTIC_RETRY_ATTEMPTS`.
- Реализация — при кодинге репозиториев/use-cases (A/R этапы): `withOptimisticRetry`, CAS-методы.
