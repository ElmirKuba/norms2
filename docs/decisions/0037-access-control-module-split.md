# ADR-0037: Контроль доступа вынесен из `AuthModule` в `AccessControlModule`

- **Статус:** accepted
- **Дата:** 2026-06-05
- **Решает:** Elmir (+ Claude Code, развилка при I1.5)
- **Контекст-теги:** [architecture] [backend] [conventions]
- Уточняет: [ADR-0030](./0030-stack-revision-drizzle-5layer-npm.md) (правило «кросс-домен только вниз → круговой DI исключён») и [ADR-0034](./0034-feature-first-layout.md) (раскладка модулей).

## Контекст

Регистрация по инвайту (I1.5) требует, чтобы `RegisterAccountUseCase` (область **auth**) атомарно создал аккаунт и погасил код, т.е. вызвал `InviteDomainService` (область **invites**) — корректный кросс-доменный вызов ВНИЗ (use-case A → domain-service B).

Но на уровне NestJS-модулей это рождало **цикл**: `InvitesModule` уже импортировал `AuthModule` ради `AuthGuard` (защита роутов инвайтов), а теперь `AuthModule` должен импортировать `InvitesModule` ради `InviteDomainService`. `AuthModule ⇄ InvitesModule` — ровно тот круговой DI, который запрещён правилом «кросс-домен только вниз» (CLAUDE.md / ADR-0030).

Причина цикла — `AuthModule` смешивал две разные ответственности: (1) **контроль доступа** (проверка access-токена + guard) — нужен всем фичам; (2) **auth-флоу** (рега/вход/refresh/logout) — сам зависит вниз от фич.

## Решение

Выделить контроль доступа в отдельный `AccessControlModule` (`modules/auth/access-control.module.ts`):

- **`AccessControlModule`**: провайдит `AuthGuard` + `AccessTokenService` + настроенный `JwtModule`; импортирует только `AccountModule` (guard грузит активный аккаунт); экспортит всё это. Не знает про auth-флоу и про invites.
- **`AuthModule`** (флоу): импортирует `AccessControlModule` (для выдачи access-токена в login/refresh) + `AccountModule` + `SessionsModule` + `InvitesModule`; держит контроллеры и flow-use-cases.
- Фичи с защищёнными роутами (`InvitesModule` и далее) импортируют **`AccessControlModule`**, а не `AuthModule`.

Граф модулей ацикличен: `AccessControlModule → AccountModule`; `InvitesModule → {AccountModule, AccessControlModule}`; `AuthModule → {AccessControlModule, AccountModule, SessionsModule, InvitesModule}`. Каждый кросс-доменный вызов остаётся «вниз».

Замечание о DI guard'а: guard, привязанный через `@UseGuards(AuthGuard)` в контроллере, инстанцируется в DI-скоупе **модуля-контроллера**, поэтому его зависимости (`AccessTokenService`, `AccountDomainService`) обязаны резолвиться там — отсюда экспорт `AccessTokenService` и реэкспорт `JwtModule` из `AccessControlModule`.

## Альтернативы

- **`forwardRef()` между `AuthModule` и `InvitesModule`.** Отвергнуто: это легализует круговой DI вместо его устранения — прямо противоречит правилу ADR-0030. Хрупко (порядок инициализации), маскирует архитектурный запах.
- **Перенести `AuthGuard` в `shared/`.** Отвергнуто: guard зависит от `AccessTokenService` (auth-домен) и `AccountDomainService` — это не утилитарный, а доменный контроль доступа; место ему в `modules/auth/`, а не в инфраструктурном `shared/`.
- **Дублировать выдачу/проверку токена в каждом модуле.** Отвергнуто: дублирование секрета/конфигурации JWT.

## Последствия

- Новые фичи с защищёнными роутами импортируют `AccessControlModule` (не `AuthModule`) — иначе вернётся цикл.
- `AuthModule` свободно зависит вниз от любых фич (регистрация может оркестрировать invites, далее — bans и т.п.).
- Обновить `docs/backend.md` / `docs/architecture.md` при консолидации (граница «контроль доступа vs auth-флоу»).
