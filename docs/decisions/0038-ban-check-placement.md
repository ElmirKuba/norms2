# ADR-0038: Размещение бан-чека — login + Guard через `BanCoreModule`

- **Статус:** accepted
- **Дата:** 2026-06-05
- **Решает:** Elmir (+ Claude Code, развилка при I2.5)
- **Контекст-теги:** [architecture] [backend] [domain]
- Уточняет: [ADR-0003](./0003-ban-semantics.md)/[ADR-0012](./0012-bans-derived-status.md) (эффективный бан = EXISTS active) и [ADR-0037](./0037-access-control-module-split.md) (разрыв цикла модулей выносом capability).

## Контекст

«Забанен» — производное (EXISTS active ban на target, ADR-0012). Проверка нужна в двух местах: при **входе** (login — с сообщением «кто/за что») и на **каждом защищённом запросе** (чтобы бан действовал в окне access-токена, как уже действует деактивация).

Проблема — цикл модулей: `AuthGuard` живёт в `AccessControlModule`, который импортируют все фичи, включая `BansModule` (контроллер банов под Guard). Если Guard потянет `BansModule` ради бан-чека → `AccessControlModule ⇄ BansModule`.

Второй вопрос — задержка бана: блокировать сразу (Guard на каждом запросе) или с лагом ≤TTL access-токена (только login + refresh).

## Решение

**Бан-чек делают оркестраторы — `LoginAccountUseCase` и `AuthGuard`** — кросс-доменно ВНИЗ через `BanDomainService.listActiveAgainst(accountId)`; при непустом результате бросают `AccountBannedError` (403, `ACCOUNT_BANNED`, в `details.bans` — банивший+причина по всем активным, ADR-0012). Account-домен про bans **не знает** (остаётся заменяемым).

Цикл разорван выносом логики банов в низкоуровневый **`BanCoreModule`** (`BanDomainService` + репозиторий, без зависимости от `AccessControlModule`). Его импортируют и `AccessControlModule` (для Guard; реэкспортит, т.к. Guard инстанцируется в DI-скоупе модуля-контроллера), и `AuthModule` (для login). Фича-`BansModule` (контроллер/use-cases) импортирует `AccessControlModule` + `BanCoreModule`. Граф ацикличен.

**Бан действует немедленно:** Guard проверяет на каждом запросе (консистентно с деактивацией). Один дополнительный индексный запрос (`bans_target_active_idx`) на защищённый роут — Guard и так грузит аккаунт каждым запросом.

## Альтернативы

- **Бан-чек только в login + refresh (без Guard).** Проще (Guard не зависит от bans, цикла нет без выноса), но активная сессия живёт до ≤TTL access-токена — забаненный спамер гадит ещё 15 мин, и поведение расходится с деактивацией (та — мгновенна). Отвергнуто ради немедленности и единообразия.
- **Guard импортирует `BansModule` напрямую.** Возвращает цикл `AccessControl ⇄ Bans`. Отвергнуто.
- **`forwardRef()`.** Легализует круговой DI, запрещённый ADR-0030. Отвергнуто.
- **Бан-чек внутри `AccountDomainService` (EXISTS-подзапрос/JOIN bans).** Утечка bans в account-домен — ломает заменяемость. Отвергнуто.

## Последствия

- Новый слой capability `BanCoreModule` — образец выноса общей доменной логики из-под фича-модуля (как `AccessControlModule` в ADR-0037).
- `AccountBannedError` несёт `details` → `DomainError` получил опциональные `details`, фильтр их прокидывает в конверт.
- TODO A3.3/A3.5 закрыты; `AccountDomainService` помечен как bans-agnostic.
- `api-contracts.md` при консолидации: ответ 403 `ACCOUNT_BANNED` с `details.bans` — на login и на любом защищённом роуте. Алиас банившего — пока не отдаём (TODO: join accounts).
