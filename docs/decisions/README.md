# docs/decisions/ — журнал архитектурных решений (ADR)

> Каждое значимое и трудно-обратимое решение фиксируется здесь отдельным файлом.
> Цель — чтобы через полгода было понятно **почему** так, а не «кто-то так сделал».

## Зачем ADR

`todo.md` копит вопросы «которые нужно принять». Как только вопрос **решён** — ответ переезжает сюда отдельным ADR, а строка в `todo.md` помечается `[x]` со ссылкой на номер ADR. Так решение не растворяется в переписке.

Связь с [`152fz.md`](../152fz.md): любое поле/механика, потенциально являющаяся ПДн, оформляется отдельным ADR с тегом `[152fz]` ещё до кода.

## Жизненный цикл этой папки (важно)

ADR и `decision-map.md` (🗄 в архиве — фаза 0 завершена) — это **строительные леса фазы решений**, а не финальный спек для реализации. Цель проекта — дока, по которой **Sonnet реализует фазу 1 без вопросов и багов**. Поэтому:

1. **Сейчас** (фаза решений): принимаем решения, пишем ADR, двигаем `decision-map`. Тут допустимы supersede-цепочки (ADR-0002→0014 и т.п.) — это история выбора.
2. **Потом** (консолидация): все принятые решения сводятся в **чистые reference-доки** (`database.md`, `domain-model.md`, `api-contracts.md`, `backend.md`, `frontend.md`, `ui-ux.md`, `deployment.md`, `getting-started.md`) — только актуальное «что строим», **без** замещённых вариантов и противоречий. Это и есть спек для Sonnet.
3. **После консолидации (✅ выполнено):** `decision-map` перенесён в `../archive/`; ADR оставлены как журнал «почему так» (вне implementation-поверхности — Sonnet работает по reference-докам, не по ADR). Рациональ сохранена, чтобы не пере-решать.

Леса сняты: стена (reference-доки) стоит и непротиворечива.

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
| [0019](./0019-backend-architecture-conventions.md) | Архитектура бэка: монорепо, zod-конфиг, shared, ошибки, pino, идемпотентность | accepted | [architecture] [backend] |
| [0020](./0020-api-conventions.md) | API: /api/v1, конверт ошибок, throttler, zod-DTO, токены (access в памяти, refresh httpOnly) | accepted | [api] [interface] [security] |
| [0021](./0021-tooling-defaults.md) | Тулинг: Node LTS, latest Nest/Angular, Jest, Signals (npm/Drizzle → ADR-0030) | accepted (частично → ADR-0030) | [backend] [frontend] [tooling] |
| [0022](./0022-concept-and-philosophy.md) | Концепция: ламповое invite-only, RU, некоммерческое | accepted | [product] [concept] |
| [0023](./0023-deployment-jurisdiction.md) | Деплой: РФ на время разработки, Traefik+LE, sweep, backup-домен позже | accepted | [deployment] [152fz] |
| [0024](./0024-cookie-consent-gate.md) | Блокирующий cookie-гейт (Я согласен / Покинуть сайт) | accepted | [frontend] [ux] |
| [0025](./0025-ui-ux-design-language.md) | Дизайн: тёмная+toggle, минимал с теплотой, свои компоненты на SCSS (без Tailwind) | accepted | [frontend] [ux] |
| [0026](./0026-modal-system.md) | Модалки: MatDialog, конфигурируемый shell `DialogModalData<T>`, 5 паттернов | accepted | [frontend] [ux] |
| [0027](./0027-accent-phase2-core.md) | Ядро Фазы 2 «Акцент»: гибрид-каркас, адаптивная лесенка, полная state-модель, широкий MVP | accepted | [product] [accent] [phase2] |
| [0028](./0028-accent-timezone-and-domains.md) | Акцент: timezone в accounts (R6), сферы+RPG-атрибуты целей (R10) | accepted | [accent] [phase2] [db] |
| [0029](./0029-novaskil-phase3-core.md) | НоваСкил: LMS-раздел на общем ЛК, роли N:M, контент+медиа на диске | accepted | [novaskil] [phase3] [db] |
| [0030](./0030-stack-revision-drizzle-5layer-npm.md) | Ревизия стека: Drizzle, 5-слойная архитектура (кросс-домен вниз), npm | accepted | [architecture] [backend] [db] [tooling] |
| [0031](./0031-file-storage-uploads.md) | Файлы на диске (платформенно); аватарки ЛК — задел, реализация позже | accepted (аватарки → MVP в ADR-0032) | [platform] [files] |
| [0032](./0032-phase1-refinements.md) | Фаза 1: alias/пароль 3–64, рег-режим по клику, убрать security_logs, аватарки в MVP | accepted | [phase1] [domain] [api] |
| [0033](./0033-type-hierarchy-convention.md) | Иерархия типов: Pure→Base→Full + производные утилитами, одно свойство — одно место, per-project | accepted | [architecture] [backend] [frontend] [conventions] |
| [0034](./0034-feature-first-layout.md) | Раскладка: feature-first (`modules/<feature>`) + вынесенный `database/` (ORM-граница); уточняет ADR-0030 | accepted | [architecture] [backend] [conventions] |
| [0035](./0035-concurrency-control.md) | Конкуренция: optimistic `version` на accounts + retry, атомарный счётчик/CAS сессий, READ COMMITTED | accepted | [architecture] [backend] [db] [concurrency] |
| [0036](./0036-schema-typed-against-full.md) | Схемы Drizzle типобезопасны против `XxxFull` через `defineTableWithSchema` (сохраняет вывод типов) | accepted | [architecture] [backend] [db] [conventions] |
| [0037](./0037-access-control-module-split.md) | Контроль доступа (guard+access-token) вынесен в `AccessControlModule` — разрывает цикл auth⇄invites при регистрации по коду | accepted | [architecture] [backend] [conventions] |
| [0038](./0038-ban-check-placement.md) | Бан-чек в login+Guard (немедленно) через `BanCoreModule`; `AccountBannedError` со списком активных банов | accepted | [architecture] [backend] [domain] |
| [0039](./0039-reactivation-flow.md) | Реактивация: login сигналит 403 `ACCOUNT_DEACTIVATED` + публичный `POST /auth/reactivate` (деактивированный не проходит Guard) | accepted | [domain] [backend] [api] |
| [0040](./0040-avatar-storage-convention.md) | Аватарка: `accounts.avatar` за `AvatarStoragePort`, имя `generateId().<ext>` на загрузку, magic-bytes, новый→БД→старый | accepted | [backend] [files] [phase1] |
| [0041](./0041-session-id-in-access-token.md) | `sid` (id сессии) в access-JWT — управление устройствами на access-токене; стабилен через ротацию | accepted | [backend] [security] [api] |
| [0042](./0042-avatar-crop-own-canvas.md) | Кроп аватара — свой canvas (pan+zoom→toBlob), без crop-библиотеки; ноль зависимостей | accepted | [frontend] [files] [phase1] |
| [0043](./0043-session-liveness-in-guard.md) | Guard проверяет живость сессии (`sid`) — немедленный отзыв устройства; `SessionCoreModule` (без цикла) | accepted | [backend] [security] [phase1] |
| [0044](./0044-versioning-strategy.md) | Версия продукта — файл `VERSION` (→ `GET /version` `{product,commit}`); фронт/бэк фикс 1.0.0; конвенция: фаза=мажор, подфаза=минор, фикс=патч | accepted | [backend] [frontend] [ops] |
| [0045](./0045-traefik-file-provider.md) | Traefik на file-провайдере (явные маршруты), без docker.sock — безопаснее и без квирков docker-API | accepted | [ops] [deploy] [phase1] |
| [0046](./0046-refresh-reuse-detection-and-recovery-posture.md) | Reuse-detect реплея ротированного refresh-токена (архив хешей) + posture восстановления (#2 анти-энумерацию не делаем, #3 без бэк-блэклиста) | accepted | [backend] [security] [phase1] |
| [0047](./0047-accent-naming-convention.md) | «Акцент»: конвенция имён — нейтрально-EN код/БД/routes + RU UI; маппинг (Epic Win→Goal, PowerUp→MicroWin, BadGuy→Obstacle, Ally→Supporter, …) | accepted | [accent] [phase2] |
| [0048](./0048-accent-domain-refinements.md) | «Акцент»: доменные уточнения R0/R1 — merge CheckIn↔DailyMetric; иерархия целей C+ (конфиг-глубина); StateResolver упрощённый старт; самодостаточные подфазы | accepted | [accent] [phase2] |
| [0049](./0049-accent-product-principles.md) | «Акцент»: принципы Внешняя память (GTD/Second Brain) + Самокомандование (commitment device/SDT) | accepted | [accent] [phase2] [product] |

### Ожидают решения

Все решения фазы 1 приняты (ADR-0001..0026). Отложенные на потом (⏸️) — текст Privacy Policy и ревью юриста (к деплою, фаза 1.9), backup-домен, опциональный email и блок будущих фаз — см. `../archive/decision-map.md` (блоки B/L).
