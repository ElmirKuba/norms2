# Architecture

Системный обзор Ascent. Источник продуктовых требований — [`../Technical-assignment.md`](../Technical-assignment.md).

## Контекст

```
┌─────────────────────────────────────────────────────────┐
│  Пользователь (браузер, mobile-first вёрстка)           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
              ┌──────────▼───────────┐
              │  Caddy (reverse      │   ← опционально для self-host
              │  proxy, авто-TLS)    │
              └──────┬─────┬─────────┘
                     │     │
                     ▼     ▼
          ┌──────────────┐ ┌──────────────┐
          │  Angular     │ │  NestJS API  │
          │  (статика)   │ │  /api/*      │
          └──────────────┘ └──────┬───────┘
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                  ┌──────────┐          ┌──────────┐
                  │ Postgres │          │  Redis   │
                  │ (данные) │          │ (queues) │
                  └──────────┘          └──────────┘
```

Подробности развёртывания — [`./deployment.md`](./deployment.md).

## Слои бэкенда

```
┌────────────────────────────────────────────────┐
│  HTTP layer (Controllers, Guards, Pipes)       │
│  - валидация DTO, аутентификация                │
└──────────────────────┬─────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────┐
│  Domain layer (Services)                       │
│  - бизнес-логика, инварианты, события           │
└──────────────────────┬─────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────┐
│  Persistence layer (Repositories, TypeORM)     │
│  - запросы, транзакции                          │
└──────────────────────┬─────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────┐
│  Infrastructure (Postgres, Redis, BullMQ)      │
└────────────────────────────────────────────────┘
```

Конвенции по слоям — [`./backend.md`](./backend.md).

## Модули бэкенда

Каждый модуль — независимая папка в `./nest/src/modules/`. Зависимости между модулями — только через явный `exports` и DI:

```
modules/
├─ auth/           — JWT, register, login, refresh
├─ users/          — User entity, профиль
├─ goals/          — долгосрочные цели + GoalEntry
├─ tasks/          — TaskTemplate + Task + RRULE rollover
├─ anti-habits/    — анти-привычки + дни
├─ weekly/         — недельные цели и сводка
├─ metrics/        — DailyMetrics
├─ lessons/        — DailyLesson
├─ workouts/       — программы и сессии
├─ scheduled/      — разовые задачи с дедлайном
├─ gamification/   — points, streaks, achievements (слушает события других модулей)
├─ dashboard/      — агрегированный endpoint для главного экрана
└─ realtime/       — WebSocket gateway
```

Список соответствует фазам в [`../todo.md`](../todo.md).

### Межмодульное взаимодействие

- Через `EventEmitter2` (Nest pkg `@nestjs/event-emitter`).
- Когда `tasks` помечает задачу выполненной — эмитит `task.completed` с payload.
- `gamification` подписан на эти события и пишет `PointEvent`, проверяет триггеры достижений.
- Это позволяет `gamification` ничего не знать о деталях `tasks` и наоборот.

События каталогизируются — список в [`./gamification.md`](./gamification.md#доменные-события).

## Слои фронтенда

```
src/app/
├─ core/        — singleton-сервисы (auth, http interceptors, api)
├─ shared/      — переиспользуемые компоненты, директивы, pipes
└─ features/    — фичи, lazy-loaded
   ├─ auth/
   ├─ dashboard/
   ├─ goals/
   ├─ tasks/
   ├─ anti-habits/
   ├─ weekly/
   ├─ workouts/
   └─ settings/
```

Подробности — [`./frontend.md`](./frontend.md).

## Потоки данных

### Отметка задачи выполненной

```
[Angular] DailyChecklistComponent
    ↓ TasksApiService.complete(taskId)
[HTTP] POST /api/tasks/:id/complete
    ↓
[Nest] TasksController → TasksService.complete(userId, taskId)
    ├─ обновляет Task.status = 'done', completedAt = now()
    ├─ EventEmitter.emit('task.completed', { userId, taskId, ... })
    │     ├─ GamificationService → PointsService.award(...)
    │     │     ├─ создаёт PointEvent
    │     │     └─ AchievementsService.checkTriggers(userId)
    │     │           └─ если триггер — создаёт Achievement, эмитит 'achievement.unlocked'
    │     └─ RealtimeGateway → ws.send('achievement.unlocked')
    └─ возвращает обновлённый Task
    ↓
[Angular] локально обновляет signal `tasks`, показывает галку
[Angular] WebSocket: получил 'achievement.unlocked' → toast
```

### Ролловер дня

```
[BullMQ scheduler] каждые 5 минут
    ↓
RolloverJob:
    SELECT users WHERE TIMEZONE(timezone, NOW())::date > last_rollover_date
    для каждого:
        начать транзакцию
        для каждого active TaskTemplate:
            если RRULE.matches(date):
                INSERT Task (status='pending')
        UPDATE user.last_rollover_date = today
        commit
```

Детали — [`./backend.md`](./backend.md#ролловер-дня) и [`./domain-model.md`](./domain-model.md#tasktemplate-vs-task).

## Аутентификация

- Access JWT: HS256, TTL = 15 минут, в заголовке `Authorization: Bearer <token>`.
- Refresh token: opaque (random 256-bit, base64url), хранится в `refresh_tokens` (хеш через bcrypt). TTL = 30 дней. Ротация при каждом использовании.
- На фронте: access — в памяти signal'а, refresh — в `httpOnly; secure; samesite=lax` cookie (если бэк и фронт под одним доменом). Если разные — fallback на localStorage с пометкой риска.
- Logout: revoke refresh-токена в БД, очистка signal'а.

Подробности — [`./api-contracts.md`](./api-contracts.md#auth).

## Realtime

- WebSocket gateway по пути `/ws`.
- Аутентификация: первое сообщение `{ type: 'auth', accessToken }`. Без auth-сообщения за 5 секунд — disconnect.
- Серверные события:
  - `achievement.unlocked` — новое достижение
  - `streak.milestone` — серия достигла круглого числа
  - `dashboard.invalidate` — фронту следует перезапросить дашборд (когда данные изменились с другой вкладки/устройства)

## Темпоральность

- Все даты дней (DATE без времени): `YYYY-MM-DD` в локальной TZ пользователя.
- Все timestamps: `TIMESTAMPTZ` в UTC. Конвертация в локальную — на бэке для агрегаций, на фронте для отображения.
- "Сегодня" определяется как `DATE_TRUNC('day', NOW() AT TIME ZONE user.timezone)`.

## Многопользовательность

- Один инстанс может обслуживать N пользователей.
- Все запросы к данным идут с фильтром `WHERE user_id = :currentUserId` — обеспечивается через guards и базовый `BaseService.scopedRepo`.
- В каждой таблице доменных сущностей есть `userId` с FK на `users.id`.

## Граничные случаи

| Кейс | Решение |
|---|---|
| Пользователь меняет TZ | Ролловер пересчитывается, исторические данные не трогаем |
| DST переход | RRULE-вычисления используют local date, не timestamp |
| Параллельный complete с двух вкладок | Идемпотентно: если уже `done` — повторное PATCH не пишет дубль `PointEvent` (защита через `unique(taskId, source)` где применимо, иначе через проверку текущего статуса) |
| Отметка выполнения за прошлую дату | Разрешено через отдельный endpoint с подтверждением; влияет на серии (пересчёт) |
