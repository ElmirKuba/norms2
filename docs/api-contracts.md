# api-contracts.md — REST API ЛК (фаза 1)

> Источник истины по HTTP-контрактам **ЛК / ядра платформы** (auth, профиль, инвайты, баны, сессии, восстановление, уведомления, version, техническая админка). Контракты разделов — в своих доменах: [accent](./sections/accent/api-contracts.md), [novaskil](./sections/novaskil/api-contracts.md). Конвенции — [ADR-0020](./decisions/0020-api-conventions.md). Поведение/правила — [`domain-model.md`](./domain-model.md). Все пути под `/api/v1`.

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

**Публикация отделена от доставки ([ADR-0065](./decisions/0065-release-vs-notification-split.md), 2.9.2).** С миграции `0042` релиз живёт своей строкой в таблице `releases` (`key`, `title`, `content_file`, `content_format`, `published_at`, `broadcasted_at`), а `notifications` ссылается на неё через `release_id` с `on delete cascade`. **Витрина читает `releases`, колокольчик — `notifications` со ссылкой на публикацию.** Заголовок, файл, формат и дата выпуска у релизной ноты берутся из связанной публикации (`coalesce` со старыми колонками — на переходный период и ради персональных уведомлений, у которых публикации нет вовсе). Контракты HTTP при этом **не изменились**: те же поля, те же значения.

`notification_reads` в запросах витрины больше не участвует **структурно** — таблицы просто не связаны, поэтому чтение снаружи не может задеть чей-то счётчик непрочитанного. Раньше это держалось на дисциплине запроса. Старые колонки `notifications` пока на месте: до contract-миграции на проде между накатом и стартом нового кода работает прежний контейнер.

**`content_format` (2.9.2·4)** — чем является содержимое ноты: `'md'` (текст в файле, рендерится мини-рендером и открывается модалкой) или `'page'` (**страница фронта** — лендинг релиза; файла нет, бэк её не хранит и не отдаёт, только сообщает формат — подбирает страницу фронт по `key`). Колонка `not null default 'md'` + `check`, поэтому все ноты до 2.9.2 и все будущие патчи получают текстовый формат без единой правки. Почему колонка, а не расширение в `content_file`: у страницы файла нет вовсе, и «вывод по расширению» требовал бы хранить фиктивный путь вроде `page:2.9.2` — тип, закодированный в поле для пути, читается потом как баг.

**Правило выбора формата (реш. Elmir 05.08.2026): патч `*.*.N` — по умолчанию `md`.** Лендинг заслуживает то, о чём есть что рассказать снаружи; иначе каждый мелкий фикс превращается в работу дизайнера. Правило проверяется на старте (`validateReleaseNote`), но **предупреждением, а не запретом**: живое исключение появилось сразу — 2.9.2 формально патч, а лендинг там по делу (реш. Elmir 05.08.2026: остаёмся на 2.9.2, минорный номер не берём). Номер версии выбирает человек; машина следит лишь за тем, чтобы выбор был осознанным. Жёстко отбиваются только поломки данных: `md` без файла и `page` с файлом.

- `GET /notifications` (auth) → `NotificationView[]` = `[{ id, kind: 'release'|'system'|'personal', title, body: string|null, contentFile: string|null, contentFormat: 'md'|'page', releaseKey: string|null, createdAt, publishedAt: Date|null, read: boolean }]`. **`releaseKey`** (2.9.2·4) — публичный ключ связанной публикации: по нему колокольчик строит адрес лендинга `/releases/:key` для нот формата `page`. Внутренний `id` публикации наружу не отдаётся — публичный адрес релиза это ключ, а не строка БД. Мои (broadcast + персональные мне), новые сверху, лимит 50.
- `GET /notifications/unread-count` (auth) → `{ count: number }`. Для бейджа колокольчика.
- `POST /notifications/:id/read` (auth) → 204. Идемпотентно; чужое персональное (адресовано не мне) → no-op (без утечки, без read-строки).
- `POST /notifications/read-all` (auth) → 204. Отмечает все мои непрочитанные.

Персональный хук: при регистрации по чьему-то коду пригласившему создаётся персональное уведомление «По вашему коду присоединился @<login>» (кросс-домен вниз `auth → notifications`, best-effort вне транзакции — сбой уведомления не роняет регистрацию).

## Публичная витрина релизов (2.9.1, [ADR-0064](./decisions/0064-telegram-release-channel.md))

**Без авторизации — намеренно.** Текст релиз-ноты и так публичен: `.md` раздаётся из `content/` без токена. Закрыт был только API центра уведомлений, потому что он адресный; у витрины адресности нет. Сюда ведёт ссылка из поста в Telegram-канале: пост несёт тезисы, полный текст — здесь.

- `GET /releases` → `ReleaseView[]` = `[{ key, title, body: string|null, contentFile: string|null, contentFormat: 'md'|'page', createdAt, publishedAt: Date|null }]`. Только `kind='release'`, новые сверху, лимит 100.
- `GET /releases/:key` → `ReleaseView`; нет такой релизной ноты → **404**.

**Чем `ReleaseView` отличается от `NotificationView` и почему это не косметика:**

- **нет `read`** — витрина **не трогает `notification_reads`**. Иначе чтение снаружи начало бы влиять на счётчик непрочитанного в чьём-то личном кабинете;
- **нет `id`** — публичный идентификатор это `key` (`release-2.9.0`), он же сегмент URL и часть ссылки из канала. Внутренний PK читателю не нужен и привязывал бы публичный адрес к строке БД.

**404 одинаков** для несуществующего ключа и для ключа персонального уведомления: выборка ограничена `kind='release'` на уровне репозитория, поэтому снаружи эти случаи неразличимы — иначе по коду ответа можно было бы проверять существование чужих уведомлений.

---

## Техническая админка (2.9.3) — реализована частично

> **Статус на 10.08.2026.** ✅ **Работают** (·7): `GET /admin/settings`, `PUT /admin/settings/:key`,
> `DELETE /admin/releases/:key`. 📋 **Только спроектированы:** люди и роли, чтение журнала (сама
> таблица и запись в неё есть — ·6), заявки из Telegram, состояние выпуска, создание публикации и
> вещание. Помеченные 📋 куски написаны в будущем времени и фиксируют решения до того, как их
> начнут писать; приходят вместе с фронтом админки.
>
> Фундамент готов целиком: роли (`roles`/`account_roles`, ·0), сид и назначение админов (·2),
> `@Roles('admin')` + `RolesGuard` (·3), рантайм-настройки (·4), журнал (·6).
>
> **Зачем вообще.** Единственный способ управлять продуктом сегодня — ssh и правка `.env`.
> Так бота «ставили на паузу» **стиранием токена**, а релиз-ноты чистили руками в psql.
> Админка техническая: она нужна, чтобы **не лазить по ssh**, а не чтобы стать вторым продуктом.

### Общие правила раздела

- **Все пути под `/admin/`, и это не косметика.** Один префикс = одно место, где висит
  `@Roles('admin')`, и забытый guard виден глазами, а не всплывает дырой. Админские возможности
  **не подмешиваются** в обычные ручки параметрами вида `GET /accounts?all=true`: тогда защита
  размазывается по условиям внутри метода, и однажды условие ошибётся.
- **Отказ — 404, а не 403** ([·3](./impl-phase2-plan.md)). 403 подтверждает, что ручка есть:
  перебрал адреса — получил карту админки, даже не открыв ни одной. Для не-админа раздела `/admin`
  не существует вовсе.
- **Роль читается из базы на каждом запросе**, а не берётся из токена: снятая роль действует
  сразу, а не после истечения access-токена.
- **Всё изменяющее пишется в журнал** (·6): кто, что, когда, над кем. Права без следа — доверие
  на слово, а поверхность доверия с ·3а расширяется с одного chat_id до «любого с ролью `admin`».
- **ПДн здесь не появляются** ([`152fz.md`](./152fz.md)): админ видит то же, что видно в продукте
  (логин, псевдоним, даты, счётчики). Ни хэшей паролей, ни ответов на секретные вопросы, ни
  содержимого чужих разделов админка не отдаёт **никогда** — «я же админ» не основание.

### Люди и роли

- `GET /admin/accounts?query=&limit=&cursor=` (admin) → `{ items: AdminAccountView[], nextCursor: string|null }`,
  где `AdminAccountView` = `{ id, login, alias, roles: string[], registrationSource, invitesRemaining, deactivatedAt, deletedAt, createdAt }`.
  `query` — подстрока логина/псевдонима. Курсор, а не номер страницы: список растёт с конца, и
  на смещениях строки бы дублировались.
- `GET /admin/roles` (admin) → `RoleView[]` = `[{ code, title, description: string|null }]` —
  справочник. **Роли это строки в таблице, а не enum в коде:** новая роль добавляется записью, без
  миграции и без правки `check`.
- `POST /admin/accounts/:id/roles` (admin) Body `{ code }` → 200 `AdminAccountView`. Идемпотентно:
  повтор ничего не меняет и не считается ошибкой.
- `DELETE /admin/accounts/:id/roles/:code` (admin) → 200 `AdminAccountView`.
  - ⛔ **Снять `admin` с самого себя нельзя** → 409 `LAST_ADMIN_PROTECTION`. Это не забота о
    самолюбии: аварийного люка в продукте нет осознанно ([·3а](./impl-phase2-plan.md)), и админ,
    разжаловавший себя, чинится только руками в базе. Запрет на себя заодно **гарантирует, что
    хотя бы один админ останется всегда** — последнему просто некого разжаловать, кроме себя.
  - ✅ **Снятие роли окончательно** (с 12.08.2026). Раньше сид назначал администраторов по
    списку `ADMIN_LOGINS`, и снятая роль возвращалась на следующем старте — операция была
    сделана наполовину, и ответ нёс флаг `willBeRestoredBySeed`. Механизм убран: логин первого
    админа не должен жить в конфиге открытого проекта, роль выдаётся скриптом
    `scripts/grant-admin.sh`. Флага в ответе больше нет и не нужно.

### Настройки

✅ **Реализовано (·7).** Отдаются только **редактируемые** ключи: показывать то, что нельзя
изменить, значит обещать рычаг, которого нет.

- `GET /admin/settings` (admin) → `SettingView[]` = `[{ key, value, source: 'db'|'env', updatedBy: string|null, updatedAt: Date|null }]`.
  `source` показывает, откуда действующее значение: `env` — начальное, строки в базе ещё нет;
  `db` — перекрыто админкой. Без этого поля «почему значение такое» не читается с экрана.
- `PUT /admin/settings/:key` (admin) Body `{ value: string }` → 200 `SettingView`.
  - **Ключи из белого списка, незнакомый → 404.** Открытый key/value по HTTP превращается в
    свалку: заводятся ключи, которых никто не читает, а опечатка в имени создаёт новую настройку
    вместо ошибки. Сейчас в списке один — `telegram.bot.paused`.
  - **Переключение действует сразу, без перезапуска** — ради этого настройки и переехали в базу
    (·4). ✅ Проверено живьём 10.08.2026: в одном процессе, между двумя запросами только `PUT`,
    вебхук перестал обрабатывать апдейты и после обратного переключения начал снова.
  - ⚠️ Кэш настроек живёт в процессе: при втором экземпляре бэка переключение в одном не увидит
    другой. Сейчас экземпляр один.

### Заявки из Telegram

- `GET /admin/telegram/requests?status=pending|approved|rejected` (admin) → `AdminTelegramRequestView[]`
  = `[{ id, type, status, chatId, accountId: string|null, login: string|null, grantedAmount: number|null, decisionReason: string|null, createdAt, decidedAt: Date|null }]`.
- `POST /admin/telegram/requests/:id/approve` (admin) Body `{ grantedAmount, reason? }` → 200 `{ request: AdminTelegramRequestView, notified: boolean }`.
- `POST /admin/telegram/requests/:id/reject` (admin) Body `{ reason }` → 200 такой же формы.
  - **Зовут тот же use-case, что и бот**, а не свою копию логики. Иначе два пути решения заявки
    разъедутся в мелочах (текст ответа, пересчёт квоты, закрытие очереди), и разойдутся они молча.
  - **`notified: false` — штатный ответ, а не ошибка.** Бот на паузе (или без токена) — решение
    всё равно записывается, человек просто не получает сообщения. Обратный вариант (запретить
    решать, пока бот молчит) делает паузу тормозом всей работы, а заявка от этого не исчезает.
    Админка обязана показать этот флаг: «решено, но человек не в курсе» — состояние, о котором
    нельзя молчать.
  - `chatId` наружу отдаётся **только админу** и только здесь: это идентификатор человека в чужом
    сервисе. Срок его хранения — [открытый хвост](./open-threads.md).

### Журнал действий (2.9.3·6 — таблица и запись уже есть, ручки ещё нет)

- `GET /admin/audit-log?limit=` (admin) → `AuditEntryView[]` = `[{ id, createdAt, actorLogin: string|null, action, targetType: string|null, targetId: string|null, targetLabel: string|null, details: object|null }]`.
  Новые сверху, по умолчанию 100.
  - **`actorLogin: null` означает «система»**, а не «неизвестно»: сид выдаёт роли при старте, и это
    тоже изменение прав. Логин хранится **снимком** рядом со ссылкой на аккаунт — чтобы след
    пережил удаление этого аккаунта; ссылка при удалении обнуляется (`set null`), а не уносит
    запись каскадом.
  - **Ручки «удалить запись» нет и не будет.** В порте репозитория отсутствуют `update` и
    `delete` — журнал, умеющий править себя, не доказывает ничего. Подчистить след можно только
    руками в базе, то есть заметным осознанным действием.
  - **Запись — best-effort:** сбой журнала пишется в лог уровня `error`, но не роняет операцию.
    Цена признана: сбой = пропавшая улика. Обратный выбор (не менять роль, если не смогли
    записать) делает журнал единой точкой отказа админки.
  - ⬜ Срок хранения не решён — [открытый хвост](./open-threads.md).

### Состояние выпуска

- `GET /admin/release-state` (admin) → `{ product, commit, migrations: { applied: number, last: string|null }, counters: { accounts, releases, notifications }, lastRelease: { key, publishedAt, broadcastedAt: Date|null } | null }`.
  - Отвечает на вопрос, который сейчас задаётся глазами по каналу: **«последний релиз объявлен?»**
    Ошибки доставки в канал глушатся осознанно ([ADR-0064](./decisions/0064-telegram-release-channel.md)),
    и «посты перестали уходить» видно только по логам — это [открытый хвост](./open-threads.md),
    и эта ручка его закрывает наполовину: `broadcastedAt: null` у свежего релиза виден сразу.
  - `migrations.last` — тег последней накатанной миграции; расхождение с кодом означает, что
    контейнер поднялся на старой базе.

### Релизы: публикация и вещание вручную

- `POST /admin/releases` (admin) Body `{ key, title, contentFile?, contentFormat, publishedAt? }` → 201 `ReleaseView`.
- `POST /admin/releases/:key/broadcast` (admin) → 200 `{ broadcastedAt: Date|null, sent: boolean }`. Повтор
  по уже объявленному релизу → 409 `ALREADY_BROADCASTED`: канал не должен получать один и тот же
  пост дважды из-за двойного клика.
- ✅ `DELETE /admin/releases/:key` (admin) → 204 (·7); несуществующий ключ → 404. Каскад уносит доставку и отметки прочтения
  ([ADR-0065](./decisions/0065-release-vs-notification-split.md)). Сейчас это делается руками в
  psql — ровно то, чем занимались 09.08.2026.
  - ⚠️ **Удаление необратимо и видно людям:** нота исчезает из колокольчиков вместе с отметками
    «прочитано». Пост в Telegram при этом **остаётся** — бот не хранит id постов канала и удалять
    их не умеет; чистить канал придётся руками.

**Почему публикация уехала в админку, а не осталась автоматикой сида.** Сидер отрабатывает при
каждом старте бэка, и выкатка = вещание: именно поэтому при 2.9.2 пришлось гасить бота стиранием
токена, а реестр нот в сиде держат **пустым как рубильник**. Человек должен выбирать момент,
когда о релизе узнают, — это редкое, осознанное и заметное действие, а не побочный эффект деплоя.
