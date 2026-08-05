# api-contracts.md — REST API ЛК (фаза 1)

> Источник истины по HTTP-контрактам **ЛК / ядра платформы** (auth, профиль, инвайты, баны, сессии, восстановление, уведомления, version). Контракты разделов — в своих доменах: [accent](./sections/accent/api-contracts.md), [novaskil](./sections/novaskil/api-contracts.md). Конвенции — [ADR-0020](./decisions/0020-api-conventions.md). Поведение/правила — [`domain-model.md`](./domain-model.md). Все пути под `/api/v1`.

## Общее

- **Успех:** данные в теле, статус 2xx. **Ошибка:** `{ error: { code, message, details? } }` + HTTP-статус.
- **Аутентификация:** `Authorization: Bearer <access-jwt>` (access в памяти фронта). Refresh — в httpOnly cookie ([ADR-0020](./decisions/0020-api-conventions.md) F7).
- **id** в путях/телах — строка `uuidv7___unixmillis` ([ADR-0016](./decisions/0016-primary-key-format.md)).
- **Rate-limit** (🛡) — на отмеченных эндпоинтах.
- Тела с плейнтекст-секретами — только по HTTPS, не логируются ([ADR-0009](./decisions/0009-server-side-hashing.md)).

## Общие коды ошибок

`VALIDATION_FAILED` (400) · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `RATE_LIMITED` (429).

---

## Публичная конфигурация

### `GET /public-config` (2.9.1, реш. Elmir 05.08.2026)
Публичный. **Единственный запрос, который фронт делает на инициализации** — всё, что нужно до входа, приходит одним ответом.
→ 200 `{ "features": { "freeRegistration": boolean }, "telegram": { "botUsername": string, "botUrl": string } }`

**Свойства не смешиваются:** `features` отвечает «что включено» и меняет поведение, `telegram` — контент (куда писать за заявкой). Лежат рядом, но под своими ключами.

⚠️ **Сюда попадает только то, что и так публично.** Ручка открыта без авторизации: ничего влияющего на доступ, никаких идентификаторов чатов и секретов. Пустые строки Telegram означают, что бот на стенде не настроен, — фронт тогда не показывает ссылку вместо битой.

Заменил прежний `GET /feature-flags` (удалён): два публичных источника конфигурации расходились бы.

### `GET /auth/registration-mode` ([ADR-0032](./decisions/0032-phase1-refinements.md))
Публичный, лёгкий. Фронт зовёт **в момент нажатия «Регистрация»** (не из кэша флагов) — чтобы показать актуальный экран (форма vs ввод кода), даже если флаг с главной устарел.
→ 200 `{ "mode": "free" | "invite" }`.

### `GET /version` ([ADR-0044](./decisions/0044-versioning-strategy.md))
Публичный (футер виден до входа). Версия развёрнутого билда.
→ 200 `{ "product": string, "commit": string }` — `product` из файла `VERSION` в корне репо (единый source of truth), `commit` — git-SHA билда (пусто в dev). Версии фронта/бэка зафиксированы на `1.0.0` и не отдаются (пересмотр ADR-0044 от 2026-06-15).

---

## Auth ([ADR-0010](./decisions/0010-registration-auth-flow.md))

### `POST /auth/register` 🛡
Body: `{ alias, login, password, inviteCode? }`.
- `FREE_REGISTRATION=true` → `inviteCode` игнорируется; аккаунт-корень (`registration_source=free`).
- `false` → `inviteCode` обязателен и валиден; иначе ошибка.
- **Токены не выдаются.**
→ 201 `{ accountId }`.
Ошибки: `VALIDATION_FAILED`; `CONFLICT` (`LOGIN_TAKEN`); `FORBIDDEN` (`INVITE_REQUIRED` / `INVITE_INVALID`).

### `POST /invites/check` 🛡
Совещательная проверка кода (без погашения). Body: `{ code }`.
→ 200 `{ valid: boolean, reason: string|null }`.

`reason` — подпись, с которой пригласивший создавал код; показывается приглашённому на экране `/invite` (2.9.1). Без неё экран безличный: человек видит факт приглашения, но не видит, кем и зачем он тут нужен. **Ручка публичная, значит подпись видит любой, у кого есть код** — `reason` не приватная заметка пригласившего. У невалидного кода всегда `null` (иначе по ответу можно было бы перебирать существование кодов).

### `POST /auth/login` 🛡
Body: `{ login, password }`.
→ 200 `{ accessToken }` + ставит refresh в httpOnly cookie; создаёт `session`.
Ошибки: `UNAUTHORIZED` (`BAD_CREDENTIALS`); `FORBIDDEN` (`ACCOUNT_BANNED` — `details.bans: { bannerId, bannerLogin, bannerAlias, reason }[]` (кто/за что, ADR-0012); `ACCOUNT_DEACTIVATED`; `ACCOUNT_DELETED`).

### `POST /auth/refresh`
Использует refresh-cookie → новый access + ротация refresh.
→ 200 `{ accessToken }`. Ошибки: `UNAUTHORIZED` (истёк/отозван/повторно использован → отзыв всех сессий).

### `POST /auth/logout`
Отзывает текущую сессию, чистит cookie. → 204.

---

## Recovery ([ADR-0008](./decisions/0008-account-recovery-secret-questions.md))

Настройка — для аутентифицированного:
- `GET /recovery/questions` (auth) → `SecretQaView[]` = `[{ id, question }]` (без хешей).
- `POST /recovery/questions` (auth) Body `{ question, answer }` (по 1–300) → 201 `SecretQaView` = `{ id, question }`.
- `DELETE /recovery/questions/:id` (auth) → 204.
- `PUT /recovery/required-count` (auth) Body `{ requiredCount }` (целое; домен проверяет 1 ≤ K ≤ N) → 204; вне диапазона → 422 (`RECOVERY_REQUIRED_COUNT_INVALID`). Текущее K — в `accounts.recoveryRequiredCount` (видно в `GET /accounts/me`).

Восстановление (публичное) 🛡:
- `POST /recovery/start` Body `{ login }` → 200 `{ questions: [{ id, question }] }` (K случайных). _Анти-энумерация: единообразный ответ/тайминг._
- `POST /recovery/complete` Body `{ login, answers: [{ id, answer }], newPassword }` → 200. Сверка всех K. Ошибки: `UNAUTHORIZED` (`RECOVERY_FAILED`).

---

## Профиль / аккаунт ([ADR-0017](./decisions/0017-account-soft-delete.md))

- `GET /accounts/me` (auth) → `AccountRead` (полная строка БЕЗ `passwordHash`): `{ id, login, alias, avatar: string|null, timezone, registrationSource: 'free'|'invite'|'seed', invitesRemaining, recoveryRequiredCount: number|null, deactivatedAt: string|null, deletedAt: string|null, version, createdAt, updatedAt }`. «Кто пригласил» — отдельно `GET /invites/my-inviter`; статус бана — не поле, а реакция Guard/login-флоу (ADR-0038). Список приглашённых — `GET /invites`.
- `GET /accounts/:login` (auth) → `AccountPublicView` = `{ id, login, alias, avatar: string|null }` (`id` не ПДн — нужен как `targetId` для бана из карточки; приватное — квота/K/таймзона/метки/даты — наружу не уходит).
- `PATCH /accounts/me` (auth) Body `{ alias }` → 200 `AccountRead` (обновлённый).
- `POST /accounts/me/deactivate` (auth) → 204. `POST /accounts/me/reactivate`. `DELETE /accounts/me` (soft, без UI-восстановления — [ADR-0017](./decisions/0017-account-soft-delete.md)) → 204.
- **Аватар (в MVP — [ADR-0032](./decisions/0032-phase1-refinements.md)):** `POST /accounts/me/avatar` (multipart; принимает **уже нарезанное** на фронте изображение, jpeg/png/webp, лимит размера; бэк валидирует тип/размер, кладёт в `content/avatars/`, путь → `accounts.avatar`) · `DELETE /accounts/me/avatar` → 204.

---

## Приглашения ([ADR-0007](./decisions/0007-invite-quota-counter.md), [ADR-0013](./decisions/0013-invites-lifecycle-cleanup.md))

- `POST /invites` (auth) Body `{ reason }` → 201 `{ id, code, reason, expiresAt }`. Ошибки: `FORBIDDEN` (`QUOTA_EXCEEDED` при `invitesRemaining=0`).
- `DELETE /invites/:id` (auth) → отзыв своего pending → 204 (`invitesRemaining += 1`).
- `GET /invites` (auth) → `InviteeRead[]` = `[{ accountId, login, alias, reason, invitedAt }]` (мои приглашённые; login/alias — из accounts через join).
- `GET /invites/codes` (auth) → `InviteCodeRead[]` = `[{ id, code, reason, expiresAt }]` (мои активные невыданные коды — для отзыва/обзора; истёкшие не возвращаются).
- `GET /invites/of/:accountId` (auth) → `InviteeNode[]` = `[{ accountId, login, alias, reason, invitedAt, bannedByMe }]` — **прямые дети узла дерева** (ленивое раскрытие, F3.Д); `bannedByMe` = есть ли мой активный бан на этого участника. Доступ: `accountId` = я **или** в моём поддереве (`isAncestor`), иначе 403 (`SUBTREE_FORBIDDEN`). Soft-deleted потомки скрыты.
- `GET /invites/can-ban/:accountId` (auth) → `{ allowed: boolean }` — вправе ли я забанить этот аккаунт (та же граница, что у `POST /bans`: цель ≠ я И в моём поддереве). Для видимости кнопки бана на карточке (не заменяет серверную проверку).
- `GET /invites/my-inviter` (auth) → `InviterRead | null` = `{ inviterLogin, inviterAlias, reason, invitedAt } | null` — «кто меня пригласил» (обратное ребро). `null` у корней дерева (`free`/`seed`).

---

## Баны ([ADR-0003](./decisions/0003-ban-semantics.md), [ADR-0012](./decisions/0012-bans-derived-status.md))

- `POST /bans` (auth) Body `{ targetId, reason }` → 201 `BanView` = `{ id, targetId, reason, active, createdAt }`. Право: `isAncestor(me, target)` и `target ≠ me`; иначе `FORBIDDEN` (`BAN_FORBIDDEN`). Идемпотентно (повтор активной пары обновляет причину).
- `DELETE /bans/:id` (auth) → снять **свою** запись по id бана → 204. Если запись не найдена / не ваша / уже снята → 404 (`BAN_NOT_FOUND`).
- `GET /bans` (auth) → `BanListItem[]` = `[{ id, targetId, targetLogin, targetAlias, reason, active, createdAt }]` (мои баны, вкл. историю снятых, новые сверху; login/alias цели — из accounts через join).

---

## Сессии ([ADR-0018](./decisions/0018-refresh-tokens-sessions.md))

- `GET /sessions` (auth) → `SessionView[]` = `[{ id, userAgent: string|null, createdAt, expiresAt, current: boolean }]`. `current` помечает сервер по `sid` из access-JWT (ADR-0041).
- `DELETE /sessions/:id` (auth) → завершить свою сессию по id → 204; если не найдена/не ваша → 404 (`SESSION_NOT_FOUND`).
- `DELETE /sessions/others` (auth) → завершить все, кроме текущей → 204.

---

## Статистика (overview, F4)

- `GET /stats/overview` (auth) → `OverviewStats` = `{ totalUsers, invitedDirect, subtreeTotal, inviteesBannedByMe, inviteesBannedByAncestor, bansActive, pendingCodes, invitesRemaining, activeSessions, recoveryQuestions, recoveryRequiredCount: number|null }`. Только агрегаты (счётчики), без ПДн/списков; точечные значения «здесь и сейчас» (без истории/трендов). `inviteesBannedByMe`/`inviteesBannedByAncestor` — прямые приглашённые с активным баном от меня / от вышестоящего по дереву (взаимоисключающе: забанен и мной, и вышестоящим → к «мной»); «полезность» = `invitedDirect − оба`. Сервер считает за один запрос (новые `COUNT`: пользователи active, поддерево CTE; остальное — длина существующих списков).
  - **`accent` (2.9·16)** — срез единственного живого раздела продукта: `{ today: { done, total, percent }, persistence: { totalDays, windowDays, windowSize }, focusGoal: { id, title, percentage } | null, isPaused, hasContent }`. Приходит **тем же запросом**, а не вторым походом с фронта: обзор обязан показывать согласованный снимок, а не склейку двух моментов времени.
  - Собирает [`AccentSnapshotDomainService`](../nest/src/modules/accent/dashboard/domain-services/accent-snapshot.domain-service.ts) — **раздел сам отвечает, как у него дела**, а обзор не знает ни про лесенки, ни про ленивую материализацию задач. Появятся другие разделы — рядом встанут их срезы той же формы, и модуль статистики не будет обрастать зависимостями на каждый новый раздел. Кросс-домен идёт вниз: use-case ЛК зовёт domain-service «Акцента», а не его use-case.
  - **Задачи дня материализуются и здесь** (как на дашборде раздела): обзор — тоже вход в день, а без материализации человек, заходящий только на главную, видел бы ноль вместо своих задач.
  - `hasContent = false` — у человека нет ничего своего (только примеры); экран **зовёт начать вместо нулей**: пустой раздел не должен выглядеть как проваленный. `today.total = 0` при непустом разделе — «на сегодня задач нет», а не «0%»: провалить нечего, если по расписанию ничего не выпало.

---

## Уведомления (центр уведомлений, F5.6)

Модель «fan-out-on-read»: уведомление адресовано ИЛИ всем (broadcast, `accountId=null`), ИЛИ персонально (`accountId` задан). «Прочитано» — наличие строки в `notification_reads` для смотрящего; непрочитанные = адресованные мне уведомления без моей отметки. Контент: ИЛИ inline `body`, ИЛИ `contentFile` (путь к `.md` относительно `content/`, раздаётся бэком как статика — для богатого текста релизов). Все роуты — под Guard (уведомления адресные).

**`published_at` (2.9.1·15)** — дата **выпуска** релиза; `null` у персональных уведомлений. Показывать человеку и сортировать надо по `COALESCE(published_at, created_at)`: `created_at` — это когда сидер записал строку, и после пересева одной ноты она уезжала наверх колокольчика у всех. Сортировка на бэке: `coalesce(published_at, created_at) desc, id desc`.

**`broadcasted_at` (2.9.1)** — отметка о публикации ноты во внешний канал (Telegram): `null` = ещё не объявляли. Поле служебное, наружу в контрактах не отдаётся; нужно потому, что сидер релизов отрабатывает при каждом старте бэка, и без отметки канал получал бы все ноты заново на каждый деплой.

- `GET /notifications` (auth) → `NotificationView[]` = `[{ id, kind: 'release'|'system'|'personal', title, body: string|null, contentFile: string|null, createdAt, publishedAt: Date|null, read: boolean }]`. Мои (broadcast + персональные мне), новые сверху, лимит 50.
- `GET /notifications/unread-count` (auth) → `{ count: number }`. Для бейджа колокольчика.
- `POST /notifications/:id/read` (auth) → 204. Идемпотентно; чужое персональное (адресовано не мне) → no-op (без утечки, без read-строки).
- `POST /notifications/read-all` (auth) → 204. Отмечает все мои непрочитанные.

Персональный хук: при регистрации по чьему-то коду пригласившему создаётся персональное уведомление «По вашему коду присоединился @<login>» (кросс-домен вниз `auth → notifications`, best-effort вне транзакции — сбой уведомления не роняет регистрацию).

## Публичная витрина релизов (2.9.1, [ADR-0064](./decisions/0064-telegram-release-channel.md))

**Без авторизации — намеренно.** Текст релиз-ноты и так публичен: `.md` раздаётся из `content/` без токена. Закрыт был только API центра уведомлений, потому что он адресный; у витрины адресности нет. Сюда ведёт ссылка из поста в Telegram-канале: пост несёт тезисы, полный текст — здесь.

- `GET /releases` → `ReleaseView[]` = `[{ key, title, body: string|null, contentFile: string|null, createdAt, publishedAt: Date|null }]`. Только `kind='release'`, новые сверху, лимит 100.
- `GET /releases/:key` → `ReleaseView`; нет такой релизной ноты → **404**.

**Чем `ReleaseView` отличается от `NotificationView` и почему это не косметика:**

- **нет `read`** — витрина **не трогает `notification_reads`**. Иначе чтение снаружи начало бы влиять на счётчик непрочитанного в чьём-то личном кабинете;
- **нет `id`** — публичный идентификатор это `key` (`release-2.9.0`), он же сегмент URL и часть ссылки из канала. Внутренний PK читателю не нужен и привязывал бы публичный адрес к строке БД.

**404 одинаков** для несуществующего ключа и для ключа персонального уведомления: выборка ограничена `kind='release'` на уровне репозитория, поэтому снаружи эти случаи неразличимы — иначе по коду ответа можно было бы проверять существование чужих уведомлений.
