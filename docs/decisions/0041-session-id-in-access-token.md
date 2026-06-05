# ADR-0041: `sid` (id сессии) в access-JWT — для управления устройствами

- **Статус:** accepted
- **Дата:** 2026-06-05
- **Решает:** Elmir (+ Claude Code, развилка при R3.1)
- **Контекст-теги:** [backend] [security] [api]
- Уточняет: [ADR-0018](./0018-refresh-tokens-sessions.md) (сессии/refresh), [ADR-0020](./0020-api-conventions.md) (access в памяти, refresh в httpOnly-cookie).

## Контекст

R3 даёт управление устройствами: список сессий, отзыв своей, **revoke-others** (отозвать все, КРОМЕ текущей) и пометку «текущее устройство». Для этого нужно знать **id текущей сессии** на защищённых роутах. Refresh-cookie скоупится на `/api/v1/auth` (ADR-0020) → на `/api/v1/sessions` не приходит, поэтому «текущую» сессию по cookie там не определить.

## Решение

В access-JWT добавлен claim **`sid`** = id сессии (рядом с `sub` = id аккаунта). `AccessTokenService.sign(accountId, sessionId)`; `verify` → `{ accountId, sessionId }`. `AuthGuard` кладёт `request.sessionId`. `createSession`/`rotateSession` возвращают `sessionId`; login/refresh подписывают токен с ним.

**`sid` стабилен через ротацию refresh:** ротация обновляет `token_hash` той же строки `sessions` (CAS, ADR-0035) — id строки не меняется, поэтому `sid` в новом access-токене тот же. Управление устройствами работает на access-токене, без refresh-cookie.

## Альтернативы

- **revoke-others/список под `/auth`** (где доступна refresh-cookie). Конфлует «управление сессиями» с auth-флоу и размазывает API; «текущее» определимо только там, где доходит cookie. Отвергнуто.
- **Расширить путь cookie до `/api/v1`.** Refresh-токен ходит на каждый запрос → лишняя экспозиция секрета. Отвергнуто.

## Последствия

- `AccessTokenPayload` += `sid`. `AuthenticatedRequest` += `sessionId`.
- `api-contracts.md`: access-JWT несёт `sub`+`sid` (внутреннее; клиент не парсит). Открывает R3.2 (пометка `current`) и R3.3 (`revoke-others` = отозвать все, кроме `sid`).
- Токены, выпущенные до изменения, не имеют `sid` — неважно (фаза до прод-релиза; access живёт ≤15м).
