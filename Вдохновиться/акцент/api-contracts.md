# API Contracts

REST API под префиксом `/api`. Все запросы и ответы — JSON. Аутентификация — JWT в заголовке `Authorization: Bearer <accessToken>`, кроме `/api/auth/*` и `/api/health`.

См. также: [`./domain-model.md`](./domain-model.md), [`./architecture.md`](./architecture.md).

## Общие правила

### Формат ошибок

```json
{
  "statusCode": 400,
  "error": "BadRequest",
  "code": "VALIDATION_FAILED",
  "message": "Human readable message",
  "details": [
    { "field": "email", "rule": "isEmail" }
  ]
}
```

`code` — стабильный машиночитаемый идентификатор ошибки (см. таблицу ниже).

### Коды ошибок

| Code | HTTP | Когда |
|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO не прошёл валидацию |
| `UNAUTHORIZED` | 401 | Нет токена или невалидный |
| `TOKEN_EXPIRED` | 401 | Access token expired (фронт должен сделать refresh) |
| `FORBIDDEN` | 403 | Запрос ресурса другого пользователя |
| `NOT_FOUND` | 404 | Сущность не найдена |
| `CONFLICT` | 409 | Уникальный конфликт (email уже занят, метрика на день уже есть) |
| `RATE_LIMITED` | 429 | Слишком много запросов |
| `INTERNAL` | 500 | Непредвиденная ошибка |

### Пагинация

Cursor-based:
```
GET /api/goal-entries?limit=20&cursor=eyJpZCI6Li4ufQ==
```
Ответ:
```json
{
  "items": [...],
  "nextCursor": "eyJpZCI6Li4ufQ=="
}
```
`nextCursor: null` означает конец.

### Локализация ошибок

Сервер возвращает только `code` и нейтральный английский `message`. Локализованные тексты — на фронте по словарю кодов.

---

## Auth

### POST `/api/auth/register`

Request:
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "displayName": "Elmir",
  "timezone": "Europe/Moscow",
  "locale": "ru"
}
```

Response 201:
```json
{
  "user": { "id": "...", "email": "...", "displayName": "...", "locale": "ru", "timezone": "Europe/Moscow" },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>"
}
```

Errors: `VALIDATION_FAILED`, `CONFLICT` (email уже занят).

### POST `/api/auth/login`

Request: `{ email, password }`. Response — как в register.

### POST `/api/auth/refresh`

Request: `{ refreshToken }`. Response: новые `accessToken` + `refreshToken` (ротация). Старый refresh инвалидируется.

### POST `/api/auth/logout`

Headers: `Authorization`. Body: `{ refreshToken }`. Сервер revoke-ает указанный refresh-токен. Response 204.

### GET `/api/auth/me`

Возвращает текущего пользователя.

---

## Users

### GET `/api/users/me`

То же, что `/api/auth/me`.

### PATCH `/api/users/me`

Request:
```json
{
  "displayName": "Elmir",
  "locale": "en",
  "timezone": "Asia/Tbilisi"
}
```

При смене `timezone` — пересчёт `last_rollover_date`.

---

## Goals

### GET `/api/goals?status=active&category=physical`

Response:
```json
{
  "items": [
    {
      "id": "...",
      "title": "Бег 77 км",
      "category": "physical",
      "targetValue": 77,
      "unit": "km",
      "deadline": "2026-05-03",
      "status": "active",
      "currentValue": 12.5,
      "percentage": 16.2,
      "daysLeft": 30,
      "pace": 0.41,
      "forecast": "behind"
    }
  ]
}
```

### POST `/api/goals`

```json
{
  "title": "Бег",
  "category": "physical",
  "targetValue": 77,
  "unit": "km",
  "deadline": "2026-05-03",
  "description": "..."
}
```

### GET `/api/goals/:id` / PATCH `/api/goals/:id`

### POST `/api/goals/:id/pause`

Ставит цель на паузу. Фиксирует `pausedAt = now()`, добавляет запись в `pauseHistory`.

```json
{ "reason": "Травма колена" }   // опционально
```

### POST `/api/goals/:id/resume`

Возобновляет цель. Закрывает последнюю запись в `pauseHistory` (устанавливает `resumedAt`), переводит статус в `active`.

### POST `/api/goals/:id/archive` / POST `/api/goals/:id/restore`

### POST `/api/goals/:id/entries`

```json
{ "value": 5.2, "date": "2026-04-12", "note": "Утренняя пробежка" }
```

### GET `/api/goals/:id/entries?from=2026-01-01&to=2026-04-12`

---

## Tasks

### GET `/api/task-templates`

### POST `/api/task-templates`

```json
{
  "title": "Зарядка",
  "icon": "dumbbell",
  "recurrenceRule": "FREQ=DAILY",
  "priority": "normal",
  "minVersion": "Хотя бы 5 минут растяжки"
}
```

### PATCH / DELETE `/api/task-templates/:id`

### GET `/api/tasks?date=2026-04-12`

```json
{
  "items": [
    { "id": "...", "title": "Зарядка", "status": "done", "completedAt": "...", "templateId": "..." },
    { "id": "...", "title": "Купить творог", "status": "pending", "deadline": "2026-04-12", "isOverdue": false, "category": "personal", "priority": "high", "templateId": null }
  ],
  "summary": { "total": 7, "done": 5, "pending": 2, "percentage": 71.4 }
}
```

### GET `/api/tasks/overdue`

Разовые задачи с `deadline < today()` и `status = 'pending'`. Используется виджетом "Просроченные" на дашборде.

```json
{
  "items": [
    { "id": "...", "title": "Сдать анализы", "deadline": "2026-04-10", "daysOverdue": 2, "category": "health", "priority": "urgent" }
  ],
  "count": 1
}
```

### GET `/api/tasks/due-today`

Разовые задачи с `deadline = today()` и `status = 'pending'`. Виджет "Дедлайн сегодня".

```json
{ "items": [...], "count": 2 }
```

### POST `/api/tasks` — разовая задача

```json
{
  "title": "Сдать анализы на тестостерон",
  "deadline": "2026-04-20",
  "category": "health",
  "priority": "high"
}
```

### POST `/api/tasks/:id/complete` — идемпотентно

Response: обновлённая задача + поднятые события (через WS) на frontend.

### POST `/api/tasks/:id/uncomplete`

### POST `/api/tasks/:id/postpone`

Response: `{ original: Task, postponed: Task }` (новая задача на завтра).

---

## Anti-habits

### GET `/api/anti-habits`

```json
{
  "items": [
    {
      "id": "...",
      "title": "Не смотрю порно",
      "currentAttemptStartedAt": 1748218800000,
      "attemptNumber": 1,
      "recordDays": 351,
      "isActive": true
    }
  ]
}
```

> `currentAttemptStartedAt` — unix timestamp в миллисекундах. Фронт считает прошедшее время сам: `Date.now() - currentAttemptStartedAt`, обновляет через `setInterval(1000)`. Бэк не считает "сколько прошло" — только фиксирует точку старта.

### POST `/api/anti-habits`

```json
{ "title": "Не ем треш", "description": "Без сладкого, фастфуда, чипсов" }
```

Response: созданный anti-habit, `currentAttemptStartedAt` = текущий unix ms.

### GET `/api/anti-habits/:id`

```json
{
  "id": "...",
  "title": "Не смотрю порно",
  "currentAttemptStartedAt": 1748218800000,
  "attemptNumber": 1,
  "recordDays": 351,
  "recordAttemptStartedAt": 1748218800000,
  "relapses": [
    {
      "id": "...",
      "relapseAt": 1716000000000,
      "attemptDurationMs": 30326400000,
      "note": "Начало пути."
    }
  ]
}
```

### POST `/api/anti-habits/:id/relapse`

Фиксирует рецидив. Сбрасывает таймер.

```json
{ "note": "Сорвался" }
```

Response:
```json
{
  "relapse": { "id": "...", "relapseAt": 1748305200000, "attemptDurationMs": 86400000 },
  "antiHabit": { "currentAttemptStartedAt": 1748305200000, "attemptNumber": 2, "recordDays": 351 }
}
```

### PATCH `/api/anti-habits/:id`

Изменить title, description. Не сбрасывает таймер.

### DELETE `/api/anti-habits/:id`

---

## Weekly

### GET `/api/weekly-goals?week=2026-W14`

`week` в формате ISO-8601 week date. Понедельник недели вычисляется на бэке.

### POST `/api/weekly-goals` / PATCH / DELETE / POST `:id/toggle`

### GET `/api/weekly-stats?week=2026-W14`

```json
{
  "totalTasks": 48,
  "doneTasks": 35,
  "percentage": 72.9,
  "byDay": [
    { "date": "2026-04-06", "weekday": "mon", "done": 5, "total": 7, "percentage": 71.4 },
    ...
  ],
  "bestDay":  { "date": "2026-04-08", "percentage": 100 },
  "worstDay": { "date": "2026-04-11", "percentage": 28.5 },
  "averagePercentage": 72.9
}
```

---

## Metrics

### GET `/api/metrics?from=2026-04-01&to=2026-04-30`

### GET `/api/metrics/:date`

### PUT `/api/metrics/:date`

```json
{ "sleepHours": 7.5, "energy": 8, "mood": 7, "note": "..." }
```

Идемпотентно — обновляет существующую запись или создаёт.

---

## Lessons

### GET `/api/lessons?from&to&tag=...`

### GET / PUT `/api/lessons/:date`

```json
{ "content": "Сегодня понял, что...", "tags": ["work", "energy"] }
```

---

## Workouts

### GET `/api/workouts`

### POST `/api/workouts`

```json
{
  "title": "Грудь / трицепс",
  "exercises": [
    { "name": "Жим штанги лёжа", "defaultSets": 4, "defaultReps": 8, "defaultWeight": 80 }
  ]
}
```

### PATCH / DELETE `/api/workouts/:id`

### POST `/api/workouts/:id/sessions` — начать сессию

Response: `{ sessionId, exercises: [...] }`

### PUT `/api/workout-sessions/:id/entries/:exerciseId`

```json
{ "setsCompleted": 4, "repsCompleted": [8, 8, 7, 6], "weights": [80, 80, 82.5, 82.5] }
```

### POST `/api/workout-sessions/:id/complete`

```json
{ "rpe": 8, "note": "..." }
```

---

## Scheduled Actions

### GET `/api/scheduled?status=pending`

### POST / PATCH / DELETE `/api/scheduled[/:id]`

### POST `/api/scheduled/:id/complete`

---

## Stats / Gamification

### GET `/api/me/stats`

```json
{
  "totalPoints": 12450,
  "level": 14,
  "pointsToNextLevel": 550,
  "currentStreaks": {
    "tasks": 12,
    "antiHabits": [ { "antiHabitId": "...", "title": "Не ем треш", "streak": 47 } ]
  },
  "longestStreaks": { ... },
  "recentAchievements": [
    { "code": "streak_7_days", "awardedAt": "2026-04-12T08:00:00Z" }
  ]
}
```

### GET `/api/me/achievements`

Полный список выданных + прогресс по невыданным (если применимо).

---

## Dashboard

### GET `/api/dashboard`

Агрегированный endpoint — снимок для главного экрана. Кэшируется на 30 секунд per user.

```json
{
  "today": {
    "date": "2026-04-12",
    "tasks": { "items": [...], "summary": { ... } },
    "metrics": { ... },
    "lesson": { ... }
  },
  "weeklyStats": { ... },
  "activeGoals": [ ... ],
  "overdueScheduled": [ ... ],
  "stats": { "totalPoints": ..., "level": ..., "currentStreak": 12 }
}
```

---

## WebSocket `/ws`

Клиент подключается к `wss://host/ws`, через 5 секунд должен прислать:
```json
{ "type": "auth", "accessToken": "<jwt>" }
```
Иначе disconnect.

Сервер отправляет события:

| Event | Payload |
|---|---|
| `auth.ok` | `{ userId }` |
| `auth.failed` | `{ reason }` |
| `task.completed` | `{ taskId, date }` |
| `achievement.unlocked` | `{ code, awardedAt, metadata }` |
| `streak.milestone` | `{ streakType, value }` |
| `dashboard.invalidate` | `{}` (фронт перезапрашивает `/api/dashboard`) |

---

## OpenAPI

NestJS генерирует OpenAPI через `@nestjs/swagger` на пути `/api/docs` (только в `development`).

Опционально в фазе 9: генерация Angular-клиента через `openapi-generator-cli` в `angular/src/app/core/api/generated/`. До этого — типы DTO дублируются вручную.
