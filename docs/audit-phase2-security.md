# Аудит безопасности и конкурентности (фаза 2) — read-only, субагент 2026-06-22

> Системный аналитик (субагент) прошёл по коду `nest/`+`angular/`: AuthN/AuthZ, IDOR, валидация,
> секреты, восстановление, конкурентность/идемпотентность, чистые границы, целостность. Только отчёт.

## Общая оценка

**Высокая зрелость для фазы 2.** Все per-account операции единообразно скоупятся по `accountId` из
`AuthGuard` → **IDOR не найдено** (habits/tasks/micro-wins/profile/notifications/bans/sessions/recovery).
Refresh — opaque (в БД только SHA-256), ротация CAS + reuse-detection, httpOnly+SameSite cookie; access —
короткий JWT с проверкой живости сессии/бана на каждом запросе. DTO — zod `.strict()`, `any` нет, SQL
параметризован (вкл. рекурсивные CTE), пароли/ответы — Argon2id, логи редактируются, стектрейсы не текут,
ORM не протекает за `database/`, ПДн не хранятся. **P1 (эксплуатируемых атакующим) — нет.**

## Находки

**P2 (средний риск):**
1. **Лесенка — read-modify-write без version/CAS** (`accent-ladder-engine.domain-service.ts:38-43`):
   `findOwnedOrNull → _apply → setLadder` тремя шагами; параллельные `complete` перезатирают счётчики
   (`easyStreak`/`missStreak`) → неверная планка. Нарушает ADR-0035. _Фикс:_ version-CAS на habit (как
   `_applyWithRetry` в account) или атомарный jsonb-UPDATE.
2. **`complete` задачи не идемпотентен по лесенке при гонке** (`accent-task.domain-service.ts:178-214`,
   `uncomplete` :267-279): `wasOpen` берётся из снимка до апдейта → два одновременных `complete` дважды
   двигают планку; цикл complete→uncomplete→complete крутит лесенку без отката. _Фикс:_ двигать лесенку
   только при реальной смене статуса (условный `UPDATE WHERE status IN ('pending','skipped')` + проверка rowCount).
3. **`postpone` без транзакции** (`accent-task.domain-service.ts:226-247`): создание завтрашней копии +
   закрытие исходной двумя запросами → при сбое/гонке дубль/незакрытая. _Фикс:_ обернуть в `TransactionRunner`.
4. **`JWT_ACCESS_SECRET` валиден лишь `.min(1)`** (`env.schema.ts:28-29`) → допускает слабый секрет →
   подделка access-JWT. _Фикс:_ `.min(32)` + генерация из CSPRNG. ⚠️ перед бампом схемы — проверить/ротировать
   текущий прод-секрет, иначе fail-fast уронит boot.

**P3 (гигиена):**
5. **Нет security-заголовков** (`main.ts`): нет `helmet` (X-Content-Type-Options, X-Frame-Options/CSP,
   Referrer-Policy). _Фикс:_ `helmet()` или заголовки на Traefik.
6. **CORS** (`main.ts:48-51`): схема не запрещает `CORS_ORIGIN="*"` при `credentials:true` (сейчас в проде
   пусто — безопасно). _Фикс:_ запретить `*` в `env.schema`.
7. **`JWT_REFRESH_SECRET` — мёртвая конфигурация** (`env.schema.ts:29`): объявлен обязательным, нигде не
   читается (refresh opaque). _Фикс:_ удалить из схемы и деплой-доки.
8. **`verifyAnswers` короткозамыкается на первом неверном** (`secret-qa.domain-service.ts:119-127`) — слабый
   тайминг-оракул (всё под rate-limit, число вопросов и так известно). _Опц.:_ проверять все K, отдавать в конце.
9. **Rate-limit in-memory per-instance** (`rate-limit.guard.ts:28`) — ок для single-instance; при масштабировании
   обходится. _При масштабировании:_ общий стор (Redis).

## Конкурентность — итог

Идемпотентность/атомарность реализованы там, где касается учётных данных и квот: инвайты
(`decrementInvitesRemaining` атомарный, `consumeCode` в tx), сессии (CAS+reuse), micro-win-логи
(`ON CONFLICT DO NOTHING` по дню), account (`updateWithVersion` CAS+retry). **Не покрыт ровно один
кластер — habits/tasks/лесенка** (P2 #1–3).

## Топ-5 (порядок)

1. Version-CAS на лесенку. 2. Идемпотентность `complete`. 3. Транзакция `postpone`.
4. `JWT_ACCESS_SECRET ≥ 32` + удалить мёртвый `JWT_REFRESH_SECRET`. 5. `helmet` + запрет `CORS=*`.

**#1–3 = один заход «довести Accent до ADR-0035» → это `2.4·23`.** #4 — самый серьёзный по сути (слабый
прод-секрет = подделка токенов), но дешёвый. #5 — дешёвая базовая защита. Аутентификация/авторизация/
владение/валидация/секреты — проверены, новых дыр нет.
