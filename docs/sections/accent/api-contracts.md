# Акцент — API-контракты (Фаза 2)

> REST раздела. Конвенции наследуем из фазы 1: префикс `/api/v1`, конверт ошибок `{ error: { code, message, details? } }`, zod-DTO (closed shape), access-JWT в `Authorization: Bearer`, id формата `uuidv7___unixmillis` ([ADR-0020](../../decisions/0020-api-conventions.md), [ADR-0016](../../decisions/0016-primary-key-format.md)). Сущности — [`domain-model.md`](./domain-model.md). Правила очков — [`gamification.md`](./gamification.md).
>
> Все эндпоинты — под `/api/v1/accent/...`, требуют аутентификации (раздел для авторизованных). Ресурс всегда принадлежит вызывающему `account` — чужой → `FORBIDDEN`.

## 0. Решение R6 — timezone (к подтверждению Elmir)
Ролловер задач и серии считаются по **локальной полуночи** пользователя → нужен часовой пояс. Таблицу `accounts` фазы 1 не трогаем (заморожена). **Дефолт:** хранить `timezone` (IANA, напр. `Europe/Moscow`) в **настройках раздела** `accent_settings`. Альтернатива (если Elmir решит) — добавить поле в `accounts` как платформенное. До подтверждения — `accent_settings.timezone`, дефолт из браузера при первом входе в раздел.

## Общее
- **Формат дат:** `occurred_on` — `YYYY-MM-DD` (локальная дата юзера). Таймстампы — ISO `timestamptz`.
- **Коды ошибок** (поверх общих VALIDATION_FAILED/UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/RATE_LIMITED): `GOAL_PAUSED` (запись в цель на паузе), `LADDER_LOCKED` (повышение планки в recovery), `ALREADY_RELAPSED` и т.п.
- **Пагинация:** списки сущностей малы → массивы; длинные истории (goal-entries, point-events, relapses) — cursor `?limit=&cursor=` → `{ items, nextCursor }`.
- **Идемпотентность:** complete/uncomplete безопасны к повтору; очки — partial-unique (gamification §2).

---

## 1. Настройки раздела
- `GET /accent/settings` → `{ timezone, locale?, overallStreakThreshold, accentPausedFrom? }`.
- `PATCH /accent/settings` Body `{ timezone?, overallStreakThreshold? }` → 200.
- `POST /accent/pause` / `POST /accent/resume` — пауза-режим (заморозка серий) → 204.

## 2. Identity
- `GET /accent/identity` → `{ heroName, archetype?, motto?, valuesText? }` (heroName по умолчанию = alias).
- `PUT /accent/identity` Body `{ heroName?, archetype?, motto?, valuesText? }` → 200 (предупреждение про ПДн на свободных полях).

## 3. CheckIn / состояние
- `POST /accent/checkins` Body `{ occurredOn, mood?, energy?, pain?, sleepHours?, anxiety?, focus?, note? }` → 201. Уник `(account, occurredOn)` — повтор обновляет (`PUT`-семантика upsert).
- `GET /accent/checkins?from&to` → массив.
- `GET /accent/state` → `{ state, basis }` — текущий UserState (вычисляется `StateResolver`).
- `GET /accent/recommendations` → `{ actions: [...] }` — 1–3 микро-действия по состоянию (`Recommender`).

## 4. Goals + Entries + Milestones
- `GET /accent/goals?status&domain` → массив (с вычисляемыми `currentValue/percentage/daysLeft/pace/forecast`).
- `POST /accent/goals` Body `{ title, whyItMatters?, domainKey?, unit, targetValue, deadline?, fallbackVersion? }` → 201.
- `GET /accent/goals/:id` · `PATCH /accent/goals/:id` · `POST /accent/goals/:id/archive` · `/restore`.
- `POST /accent/goals/:id/pause` · `/resume` (пауза не принимает entries).
- `POST /accent/goals/:id/entries` Body `{ value, occurredOn?, note? }` → 201. Ошибка `GOAL_PAUSED` (409). Триггерит прогресс + возможный `goal.completed`/`milestone.reached`.
- `GET /accent/goals/:id/entries?from&to` (cursor).
- `POST /accent/goals/:id/milestones` Body `{ title, thresholdValue }` · `GET .../milestones` · `DELETE .../milestones/:mid` (только не достигнутые).

## 5. Habits (TaskTemplate) + Tasks + лесенка
- `GET /accent/habits` · `POST /accent/habits` Body `{ title, description?, icon?, domainKey?, goalId?, priority?, kind, recurrence, ladder:{minTarget,currentTarget,goalTarget?,step?,policy}, minVersion? }` → 201.
- `GET/PATCH /accent/habits/:id` · `POST /accent/habits/:id/deactivate`.
- `GET /accent/tasks?date=YYYY-MM-DD` → задачи дня (материализованные + разовые).
- `GET /accent/tasks/overdue` · `GET /accent/tasks/due-today` (для разовых с deadline).
- `POST /accent/tasks` Body `{ title, occurredOn, kind, targetValue?, category?, deadline?, priority? }` → разовая (Quest).
- `POST /accent/tasks/:id/complete` Body `{ doneValue? }` → done/partial (идемпотентно). `partial≥minTarget` держит серию; триггерит `LadderEngine` (`ladder.raised/lowered`).
- `POST /accent/tasks/:id/uncomplete` → pending + revoke очков.
- `POST /accent/tasks/:id/postpone` → новый Task на завтра, текущий `skipped/postponed`.

## 6. PowerUps (микро-победы)
- `GET /accent/power-ups` · `POST /accent/power-ups` Body `{ title, category, durationSeconds, energyCost, effect?, disabledForStates? }`.
- `PATCH/DELETE /accent/power-ups/:id`.
- `POST /accent/power-ups/:id/complete` Body `{ occurredOn? }` → 201 (дневной лимит на 1 PowerUp; даёт очки).

## 7. AntiHabits
- `GET /accent/anti-habits` (с вычисл. `currentDays` на фронте) · `POST` Body `{ title, description?, targetDays? }`.
- `GET/PATCH /accent/anti-habits/:id` · `POST .../relapse` Body `{ triggerTag?, note? }` → сброс таймера, рекорд, история.
- `GET /accent/anti-habits/:id/relapses?cursor` — история попыток.

## 8. BadGuys + Counterplays
- `GET/POST /accent/bad-guys` Body `{ name, type?, trigger?, symptoms?, intensity? }`.
- `PATCH/DELETE /accent/bad-guys/:id`.
- `POST /accent/bad-guys/:id/counterplays` Body `{ text, linkedPowerUpId? }` · `GET/DELETE`.

## 9. Allies (MVP — реестр)
- `GET/POST /accent/allies` Body `{ linkedAccountId?, role, consentScope, note? }` · `PATCH/DELETE`.
- _Соц-взаимодействие (видеть прогресс с согласия, совместные челленджи) — волна 2.1+._

## 10. Недельный слой и журналы
- `GET/POST/DELETE /accent/weekly-goals?week=YYYY-Www` (+ items: `PATCH /accent/weekly-goals/:id` toggle done).
- `GET /accent/weekly-stats?week=YYYY-Www` → `{ bestDay, worstDay, avgPercent, tasksDone }`.
- `GET/PUT /accent/metrics?date=YYYY-MM-DD` (upsert; уник account+date). `GET /accent/metrics/trends?range=7|30|90`.
- `GET/PUT /accent/lessons?date=YYYY-MM-DD` (урок-якорь). `GET /accent/lessons?tag=`.

## 11. Геймификация / статистика
- `GET /accent/stats` → `{ totalXP, level, nextLevelXP, currentStreaks, longestStreaks, recentAchievements }`.
- `GET /accent/achievements` → каталог + выданные (`awardedAt|null`).
- `GET /accent/point-events?cursor` — история начислений (для прозрачности).

## 12. Dashboard (агрегатор)
- `GET /accent/dashboard?date=YYYY-MM-DD` → всё для главного экрана за 1 запрос: `{ state, recommendations, today:{tasks,percent,streak}, week:{donut,bars,best,worst}, goals:[...], metricsQuick, overdue, badGuysActive }`. Серверная агрегация ([ADR-0019](../../decisions/0019-backend-architecture-conventions.md)).

## 13. Ролловер (фон, не эндпоинт)
`@nestjs/schedule`: материализация Task из активных Habit по RRULE в локальную полночь (по `timezone`, §0). В recovery/паузе — мягкий ролловер (минимальные версии). Sweep устаревших — по образцу фазы 1.

## 14. AI-эндпоинты (волна, заложить путь)
`POST /accent/ai/decompose-goal`, `POST /accent/ai/repack-after-relapse` — с границами безопасности ([спек](../../phase2-analysis-map.md): не стыдить, не обещать лечение, объяснимость). Не в MVP.
