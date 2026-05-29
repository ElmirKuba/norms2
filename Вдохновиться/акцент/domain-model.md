# Domain Model

Полный каталог сущностей. SQL-схема — [`./database.md`](./database.md). API-контракты — [`./api-contracts.md`](./api-contracts.md).

## Карта связей

```
User ──┬── Goal ────── GoalEntry
       ├── TaskTemplate ── Task ── (postponedFromTaskId → Task)
       ├── Task (разовая, без template)
       ├── AntiHabit ── AntiHabitDay
       ├── WeeklyGoal
       ├── DailyMetrics
       ├── DailyLesson
       ├── Workout ── WorkoutExercise
       │     └── WorkoutSession ── WorkoutSessionEntry
       ├── ScheduledAction
       ├── PointEvent
       ├── Achievement
       └── RefreshToken
```

---

## User

**Поля:**
- `id` (uuid, PK)
- `email` (unique, citext)
- `passwordHash` (bcrypt)
- `displayName` (string, 1..64)
- `locale` (`ru` | `en`, default `ru`)
- `timezone` (IANA TZ, например `Europe/Moscow`, default `UTC`)
- `createdAt`, `updatedAt`

**Инварианты:**
- `email` уникальный по всей системе.
- `timezone` обязателен; если пользователь не указал — берётся из браузера при регистрации.

**API:** [`./api-contracts.md#users`](./api-contracts.md#users).

---

## Goal

Долгосрочная цель с измеримым прогрессом и опциональным дедлайном. Воспроизводит формат `00/77 (03.05.2026)` из исходных заметок.

**Поля:**
- `id` (uuid)
- `userId`
- `title` (1..200)
- `description` (text, nullable)
- `category` (`spiritual` | `physical` | `mental`)
- `targetValue` (numeric, > 0)
- `unit` (string, например `reps`, `km`, `pages`, `days`)
- `deadline` (DATE, nullable)
- `status` (`active` | `paused` | `completed` | `archived`)
- `completedAt` (timestamptz, nullable)
- `createdAt`, `updatedAt`

**Поля паузы:**
- `pausedAt` (timestamptz, nullable) — момент последней паузы
- `pauseHistory` (jsonb, nullable) — массив `[{pausedAt, resumedAt}]`, хранит всю историю пауз

**Computed (на чтение):**
- `currentValue` = SUM(GoalEntry.value WHERE goalId = this)
- `percentage` = min(currentValue / targetValue * 100, 100)
- `daysLeft` = deadline − today() в днях (nullable, если нет deadline)
- `activeDays` = daysSinceCreated минус суммарное время в паузах
- `pace` = currentValue / activeDays
- `forecast` = `'ahead'` | `'on_track'` | `'behind'` | `null` (зависит от темпа и дедлайна)

**Инварианты:**
- При `currentValue >= targetValue` сервис может (но не обязан) автоматически переводить в `completed` с `completedAt = now()`. Решение: автопереход, но цель остаётся видимой; `completedAt` фиксируется при первом достижении и не меняется при последующих записях.
- `archived` цели не участвуют в дашборде.
- `paused` цель не принимает новые `GoalEntry` и не участвует в `forecast`. В дашборде отображается с меткой "на паузе".
- Возобновление (`resume`) добавляет запись в `pauseHistory.resumedAt` и переводит в `active`. В таймлайне пауза отображается как пробел, не как удаление.
- Уже созданные `GoalEntry` при паузе не удаляются — история сохраняется полностью.

---

## GoalEntry

Запись инкремента прогресса.

**Поля:**
- `id` (uuid)
- `goalId`
- `value` (numeric, > 0)
- `date` (DATE)
- `note` (text, nullable)
- `createdAt`

**Инварианты:**
- `value > 0`. Для отката нужно удалить запись, не вводить отрицательное.
- Несколько записей за один день разрешены (например, две пробежки).

---

## TaskTemplate

Шаблон повторяющейся задачи (привычки).

**Поля:**
- `id` (uuid)
- `userId`
- `title` (1..200)
- `icon` (string, имя иконки lucide)
- `recurrenceRule` (string, RRULE-формат, например `FREQ=DAILY` или `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`)
- `priority` (`low` | `normal` | `high`, default `normal`)
- `isActive` (bool, default true)
- `minVersion` (text, nullable) — "минимум плохого дня": краткое описание упрощённой версии задачи (например, "хотя бы 10 отжиманий"). Если заполнен — отображается на карточке задачи при длинных серях или в контекстных пушах.
- `createdAt`, `updatedAt`

**Инварианты:**
- `recurrenceRule` парсится через rrule.js, ошибка парсинга — 400.
- При деактивации `isActive = false` уже созданные `Task` не трогаются.

---

## Task

Инстанс задачи на конкретный день.

**Поля:**
- `id` (uuid)
- `userId`
- `templateId` (uuid, nullable — для разовых)
- `date` (DATE) — для привычек: день материализации. Для разовых: планируемый день выполнения
- `title` (string, копируется из template или вводится для разовой)
- `category` (`personal` | `work` | `health` | `finance` | `other`, nullable) — только для разовых задач (без templateId). Привычки категорию не имеют — она задаётся через Goal
- `deadline` (DATE, nullable) — только для разовых. Если `date < today()` и статус `pending` → задача считается просроченной
- `priority` (`low` | `normal` | `high` | `urgent`, default `normal`) — для разовых; для задач из шаблона берётся из `TaskTemplate.priority`
- `status` (`pending` | `done` | `skipped` | `overdue`)
- `skipReason` (`postponed` | `cancelled` | null)
- `postponedFromTaskId` (uuid, nullable — если эта задача создана в результате переноса)
- `completedAt` (timestamptz, nullable)
- `createdAt`

**Computed (на чтение):**
- `isOverdue` = `status = 'pending'` AND `deadline < today()` — вычисляется на лету, не хранится отдельно

**Инварианты:**
- Если `status = 'done'`, то `completedAt` обязателен.
- `complete` идемпотентен: повторный вызов на уже `done` задачу — no-op (не создаёт второй `PointEvent`).
- `uncomplete` сбрасывает `completedAt` в null и status в `pending`. `PointEvent` для этой задачи удаляется (или помечается revoked).
- `postpone` создаёт новый `Task` на дату+1 со ссылкой `postponedFromTaskId = this.id`, текущему ставит `status='skipped', skipReason='postponed'`.
- BullMQ cron в полночь помечает разовые задачи с `deadline < today()` и `status = 'pending'` — они попадают в виджет "просроченные" на дашборде.

### TaskTemplate vs Task

- **TaskTemplate** — описание привычки. Редактирование шаблона не меняет историю — уже созданные `Task` сохраняют `title` на момент создания.
- **Task** — материализованный инстанс. Не редактируется задним числом, кроме явного `uncomplete`.
- Это разделение позволяет менять привычку (переименовать "Зарядка" → "Утренняя зарядка") без потери исторических данных.

---

## AntiHabit

Реестр того, что НЕ делать (анти-привычка). Аналог приложений типа "Quitzilla" — таймер с момента старта, рекорд, история попыток.

**Поля:**
- `id` (uuid)
- `userId`
- `title` (1..200)
- `description` (text, nullable)
- `isActive` (bool)
- `currentAttemptStartedAt` (bigint, unix timestamp в миллисекундах) — момент начала текущей попытки. Бэк отдаёт как есть, **фронт сам считает** прошедшее время через `Date.now() - currentAttemptStartedAt` с `setInterval(1000)`.
- `attemptNumber` (int, default 1) — номер текущей попытки
- `recordDays` (int, default 0) — рекорд в днях (лучшая завершённая попытка)
- `recordAttemptStartedAt` (bigint, nullable) — когда начался рекордный отрезок
- `createdAt`, `updatedAt`

**При рецидиве (`relapse`):**
- `currentAttemptStartedAt` = now() в ms
- `attemptNumber` += 1
- Если текущая серия в днях > `recordDays` → обновляем `recordDays` и `recordAttemptStartedAt`
- Создаётся запись `AntiHabitRelapse` (история)

---

## AntiHabitRelapse

История рецидивов (заменяет `AntiHabitDay` для timer-модели).

**Поля:**
- `id` (uuid)
- `antiHabitId`
- `relapseAt` (bigint, unix ms) — момент рецидива
- `attemptDurationMs` (bigint) — сколько продержался в этой попытке
- `note` (text, nullable) — комментарий пользователя ("что случилось")
- `createdAt`

**Инварианты:**
- Только для записи, не редактируется задним числом.
- `attemptDurationMs = relapseAt - prevAttemptStartedAt`.

---

## WeeklyGoal

Цель на текущую неделю (5 целей по умолчанию). Аналог из исходного шаблона.

**Поля:**
- `id` (uuid)
- `userId`
- `weekStart` (DATE — понедельник недели)
- `title` (1..200)
- `completed` (bool)
- `position` (int — порядок отображения)
- `createdAt`, `updatedAt`

**Инварианты:**
- Уникальность: `(userId, weekStart, position)`.

---

## DailyMetrics

Метрики самочувствия за день.

**Поля:**
- `id` (uuid)
- `userId`
- `date` (DATE)
- `sleepHours` (numeric 0..24, шаг 0.5)
- `energy` (int 1..10)
- `mood` (int 1..10)
- `note` (text, nullable)
- `createdAt`, `updatedAt`

**Инварианты:**
- Уникальность: `(userId, date)` — одна запись на день.
- Все три значения обязательны при создании; обновляются вместе.

---

## DailyLesson

"Урок дня" — рефлексивная заметка.

**Поля:**
- `id` (uuid)
- `userId`
- `date` (DATE)
- `content` (text, markdown)
- `tags` (text[])
- `createdAt`, `updatedAt`

**Инварианты:**
- Уникальность: `(userId, date)`.

---

## Workout / WorkoutExercise

Шаблон тренировки.

**Workout:**
- `id`, `userId`, `title`, `description` (nullable), `position` (int), `isActive`

**WorkoutExercise:**
- `id`, `workoutId`, `name`, `defaultSets` (int), `defaultReps` (int), `defaultWeight` (numeric, nullable), `position`

## WorkoutSession / WorkoutSessionEntry

Фактическая выполненная тренировка.

**WorkoutSession:**
- `id`, `userId`, `workoutId`, `startedAt`, `completedAt` (nullable), `rpe` (int 1..10, nullable), `note`

**WorkoutSessionEntry:**
- `id`, `sessionId`, `exerciseId` (FK на WorkoutExercise или snapshot имени для устойчивости при удалении), `setsCompleted`, `repsCompleted` (int[]), `weights` (numeric[]), `note`

**Инварианты:**
- `completedAt` устанавливается при `POST /api/workout-sessions/:id/complete`.
- Длина `repsCompleted` и `weights` равна `setsCompleted`.

---

## ScheduledAction

Разовая запланированная задача (например, "Сдать тестостерон").

**Поля:**
- `id`, `userId`, `title`, `description`, `dueDate` (DATE), `reminderDaysBefore` (int, nullable), `status` (`pending` | `done` | `cancelled`), `completedAt`

---

## PointEvent

Запись начисления очков.

**Поля:**
- `id`, `userId`, `source` (`task` | `goal_entry` | `anti_habit_held` | `workout_session` | `streak_milestone`), `sourceId` (uuid), `points` (int), `createdAt`, `revokedAt` (nullable)

**Инварианты:**
- Идемпотентность по `(source, sourceId)` — нельзя начислить очки дважды за один и тот же факт.
- `revokedAt` устанавливается, если факт отозван (например, `uncomplete` задачи). При расчёте суммы `revokedAt IS NULL` — обязательное условие.

---

## Achievement

Выданное достижение.

**Поля:**
- `id`, `userId`, `code` (string — стабильный идентификатор: `streak_7_days`, `first_goal_completed`, ...), `awardedAt`, `metadata` (jsonb, опциональный контекст: какая именно цель/привычка)

**Инварианты:**
- Уникальность: `(userId, code)` — каждое достижение выдаётся один раз.
- Каталог достижений — [`./gamification.md#достижения`](./gamification.md#достижения).

---

## RefreshToken

Хранение refresh-токенов (opaque).

**Поля:**
- `id`, `userId`, `tokenHash` (bcrypt от секрета), `expiresAt`, `revokedAt` (nullable), `createdAt`, `lastUsedAt` (nullable), `userAgent` (text, nullable), `ipAddress` (inet, nullable)

**Инварианты:**
- Поиск по `tokenHash` через bcrypt.compare (не индексируем, ищем по `userId` + проверяем все активные хеши пользователя).
- При использовании — ротация: создаётся новый, старый помечается `revokedAt`.
