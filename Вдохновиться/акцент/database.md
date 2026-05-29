# Database

PostgreSQL 16. Управление через TypeORM, миграции — вручную (`migration:generate` + ручная вычитка). Никакого `synchronize: true` в продакшене.

Источник доменных требований — [`./domain-model.md`](./domain-model.md).

## Конвенции

- Таблицы — `snake_case`, множественное число (`users`, `goals`, `goal_entries`).
- PK — всегда `id uuid DEFAULT gen_random_uuid()` (расширение `pgcrypto`).
- FK — `<entity>_id`, всегда `ON DELETE CASCADE` для дочерних, `RESTRICT` для shared (в основном через soft delete).
- Все timestamps — `TIMESTAMPTZ`. Все дни — `DATE`.
- `created_at` / `updated_at` обязательны для всех таблиц, кроме чисто immutable (`goal_entries`, `point_events`).
- Деньги — `numeric(12, 2)`. Числа с плавающей точкой для измерений — `numeric(10, 3)`.
- Enum-ы — через `CHECK` constraint (`status TEXT CHECK (status IN ('active', 'completed', 'archived'))`), не через PostgreSQL enum-тип (миграции enum painful).

## Расширения

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email
```

## Миграции

Файлы в `nest/src/migrations/NNN-name.ts`. Нумерация — `001`, `002`, ...

Команды (объявлены в `nest/package.json`):
```
npm run migration:generate -- -n <Name>
npm run migration:run
npm run migration:revert
```

## Схема (DDL — концептуально)

> Ниже — обзор. Реальные миграции пишутся через TypeORM и проходят ревью. Не копировать DDL отсюда напрямую.

### users

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name  varchar(64) NOT NULL,
  locale        varchar(8) NOT NULL DEFAULT 'ru',
  timezone      varchar(64) NOT NULL DEFAULT 'UTC',
  last_rollover_date date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

### refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  user_agent   text,
  ip_address   inet,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
```

### goals

```sql
CREATE TABLE goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         varchar(200) NOT NULL,
  description   text,
  category      text NOT NULL CHECK (category IN ('spiritual', 'physical', 'mental')),
  target_value  numeric(12, 3) NOT NULL CHECK (target_value > 0),
  unit          varchar(32) NOT NULL,
  deadline      date,
  status        text NOT NULL CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
```

### goal_entries

```sql
CREATE TABLE goal_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  value      numeric(12, 3) NOT NULL CHECK (value > 0),
  date       date NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_goal_entries_goal_date ON goal_entries(goal_id, date);
```

### task_templates / tasks

```sql
CREATE TABLE task_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           varchar(200) NOT NULL,
  icon            varchar(64),
  recurrence_rule text NOT NULL,
  priority        text NOT NULL CHECK (priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id            uuid REFERENCES task_templates(id) ON DELETE SET NULL,
  date                   date NOT NULL,
  title                  varchar(200) NOT NULL,
  status                 text NOT NULL CHECK (status IN ('pending', 'done', 'skipped')) DEFAULT 'pending',
  skip_reason            text CHECK (skip_reason IN ('postponed', 'cancelled')),
  postponed_from_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  completed_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX idx_tasks_template ON tasks(template_id);
```

### anti_habits / anti_habit_days

```sql
CREATE TABLE anti_habits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       varchar(200) NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE anti_habit_days (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anti_habit_id uuid NOT NULL REFERENCES anti_habits(id) ON DELETE CASCADE,
  date          date NOT NULL,
  state         text NOT NULL CHECK (state IN ('held', 'relapsed')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anti_habit_id, date)
);
```

### weekly_goals

```sql
CREATE TABLE weekly_goals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,  -- monday
  title      varchar(200) NOT NULL,
  completed  boolean NOT NULL DEFAULT false,
  position   int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, position)
);
```

### daily_metrics

```sql
CREATE TABLE daily_metrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  sleep_hours  numeric(4, 1) NOT NULL CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  energy       int NOT NULL CHECK (energy BETWEEN 1 AND 10),
  mood         int NOT NULL CHECK (mood BETWEEN 1 AND 10),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
```

### daily_lessons

```sql
CREATE TABLE daily_lessons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  content    text NOT NULL,
  tags       text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX idx_daily_lessons_tags ON daily_lessons USING gin (tags);
```

### workouts / workout_exercises / workout_sessions / workout_session_entries

```sql
CREATE TABLE workouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       varchar(200) NOT NULL,
  description text,
  position    int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workout_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id      uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name            varchar(200) NOT NULL,
  default_sets    int NOT NULL CHECK (default_sets > 0),
  default_reps    int NOT NULL CHECK (default_reps > 0),
  default_weight  numeric(7, 2),
  position        int NOT NULL DEFAULT 0
);

CREATE TABLE workout_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id   uuid REFERENCES workouts(id) ON DELETE SET NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  rpe          int CHECK (rpe BETWEEN 1 AND 10),
  note         text
);

CREATE TABLE workout_session_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name   varchar(200) NOT NULL,  -- snapshot, чтобы не зависело от удаления exercise
  exercise_id     uuid REFERENCES workout_exercises(id) ON DELETE SET NULL,
  sets_completed  int NOT NULL,
  reps_completed  int[] NOT NULL,
  weights         numeric(7, 2)[],
  note            text
);
```

### scheduled_actions

```sql
CREATE TABLE scheduled_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 varchar(200) NOT NULL,
  description           text,
  due_date              date NOT NULL,
  reminder_days_before  int CHECK (reminder_days_before >= 0),
  status                text NOT NULL CHECK (status IN ('pending', 'done', 'cancelled')) DEFAULT 'pending',
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_user_status_due ON scheduled_actions(user_id, status, due_date);
```

### point_events / achievements

```sql
CREATE TABLE point_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     text NOT NULL CHECK (source IN ('task', 'goal_entry', 'anti_habit_held', 'workout_session', 'streak_milestone')),
  source_id  uuid NOT NULL,
  points     int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (source, source_id)
);
CREATE INDEX idx_point_events_user_active ON point_events(user_id) WHERE revoked_at IS NULL;

CREATE TABLE achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        varchar(64) NOT NULL,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb NOT NULL DEFAULT '{}',
  UNIQUE (user_id, code)
);
```

## Стратегия индексов

Базовые правила:
- На любую FK, по которой делаем `WHERE` или `JOIN` — индекс.
- На пары `(user_id, date)` для дневных запросов — индекс.
- Для списков с пагинацией по `created_at desc` — индекс на `(user_id, created_at DESC)`.

## Backup / Restore

Команды и расписание — [`./deployment.md#backup`](./deployment.md#backup).
