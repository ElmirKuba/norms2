# ADR-0020: Конвенции API (F1–F7)

- **Статус:** accepted
- **Дата:** 2026-05-30
- **Решает:** Elmir + рекомендации Claude (пункты F1–F7)
- **Контекст-теги:** [api] [interface] [frontend] [security]

## Решение

- **F1 — версионирование:** все эндпоинты под префиксом `/api/v1`.
- **F2 — формат ответа:** успех — данные напрямую в теле (2xx). Ошибка — конверт `{ error: { code, message, details? } }` ([ADR-0019](./0019-backend-architecture-conventions.md) C6) + соответствующий HTTP-статус.
- **F4 — пагинация:** списки фазы 1 ограниченно малы (инвайтов ≤3, баны/сессии — единицы) → возвращаем массивы без пагинации. Если понадобится — конвенция `?limit=&offset=`; ввод задокументировать здесь же.
- **F5 — rate-limit:** `@nestjs/throttler` по IP на чувствительных: `auth/login`, `auth/register`, `recovery/*`, `invites/check`. Защита от брутфорса пароля/ответов и энумерации кодов/логинов.
- **F6 — валидация DTO:** **zod** (`nestjs-zod`) — closed shapes, явные схемы, без декоратор-магии (предпочтение Elmir). Единый стиль с zod-валидацией ENV.
- **F7 — токены на клиенте:** access-JWT — в памяти (Angular Signal, не localStorage); refresh — в **httpOnly + Secure + SameSite** cookie (недоступен JS → защита от XSS-кражи). `auth/refresh` читает cookie и ротирует ([ADR-0018](./0018-refresh-tokens-sessions.md)); logout чистит cookie и отзывает сессию.

## Альтернативы
- class-validator (F6) — декораторы, «магия», Elmir не любит. Отвергнут в пользу zod.
- refresh в localStorage (F7) — уязвим к XSS. Отвергнут в пользу httpOnly cookie.
- problem+json (F2) — избыточно; свой конверт компактнее.

## Последствия
- `api-contracts.md` — полный список эндпоинтов с DTO в этом стиле.
- `frontend.md` — access в Signal, refresh через httpOnly cookie, interceptor на 401→refresh.
- `backend.md` — throttler-конфиг, nestjs-zod pipe, cookie-настройки (Secure в проде).
- CSRF: т.к. refresh в cookie — `SameSite=strict/lax` + проверка origin на мутациях; детали в `backend.md`.
- Зависимости: `@nestjs/throttler`, `nestjs-zod`, `zod`, cookie-parser.
