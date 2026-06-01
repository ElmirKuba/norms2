# Акцент — доменная модель (Фаза 2)

> Сущности, поля, инварианты, состояния, механика лесенки. Каркас — [ADR-0027](../../decisions/0027-accent-phase2-core.md). Привязка к фундаменту — [README](./README.md). Геймификация — [`gamification.md`](./gamification.md). Схема БД/контракты — синтезируются на базе этого файла.
>
> **Слой:** бизнес-логика без прямого ORM — доступ к данным через adapters→repositories (5-слойка, [ADR-0030](../../decisions/0030-stack-revision-drizzle-5layer-npm.md), [архитектура](../../architecture.md)). Все id — `uuidv7___unixmillis` ([ADR-0016](../../decisions/0016-primary-key-format.md)). Все сущности принадлежат `accounts` фазы 1 через `account_id` (отдельного User нет). У всех — `created_at`/`updated_at`; мягкое удаление через `archived`/`deleted_at` по образцу фазы 1.

## 0. Карта связей

```
account (фаза 1)
 ├─ Identity            1:1   (игровая личность, развитие alias)
 ├─ CheckIn             1:N   (состояние дня → UserState)
 ├─ Goal                1:N   ── GoalEntry 1:N
 │                            └─ Milestone 1:N
 ├─ Domain(ref)         N     (сфера жизни — справочник + привязки)
 ├─ Habit (TaskTemplate)1:N   ── Task 1:N (материализация на день)
 ├─ Task (разовая)      1:N
 ├─ PowerUp             1:N   ── PowerUpLog 1:N
 ├─ AntiHabit           1:N   ── AntiHabitRelapse 1:N
 ├─ BadGuy              1:N   ── Counterplay 1:N
 ├─ Ally                1:N   (опц. ссылка на account через инвайт-дерево)
 ├─ WeeklyGoal          1:N   ── WeeklyGoalItem 1:N
 ├─ DailyMetric         1:N   (uniq account+date)
 ├─ DailyLesson         1:N   (uniq account+date)
 ├─ PointEvent          1:N   (идемпотентно)
 └─ Achievement(UserAchievement) 1:N
```

## 1. Value objects / перечисления

- **`Id`** — VO формата `uuidv7___unixmillis`.
- **`UserState`** = `survival | recovery | stability | growth | sprint | maintenance` (+ производные «перегружен/откатился» вычисляются, не хранятся).
- **`DomainKey`** — сфера жизни: `health | sleep | sport | work | money | relationships | learning | home | creativity | purpose` (расширяемо; справочник, не жёсткий enum в БД).
- **`Attribute`** (RPG-прокачка, [ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)) — `strength | discipline | intellect | spirit | social | health` (расширяемо). Цель/привычка может прокачивать 0..N атрибутов → «паучья диаграмма» баланса + связь с Secret Identity. Сфера (факт) и атрибуты (игра) — параллельны, не взаимоисключающи.
- **`HabitKind`** = `binary | quantitative | timed` (тип измерения выполнения).
- **`Priority`** = `low | normal | high | urgent`.
- **`ProgressUnit`** — свободная строка (`раз`, `км`, `страниц`, `мин`). Числа прогресса — `numeric`, не float.

## 2. Identity (игровая личность)

Развитие `alias` из ЛК — психодистанция «я не ленивый, я игрок в тяжёлом квесте».
- `account_id` (PK=FK, 1:1), `heroName?` (по умолчанию = alias), `archetype?`, `motto?`, `valuesText?`.
- Инвариант: не обязательна; отсутствие = используется `alias`. Не содержит ПДн (предупреждение на свободных полях).

## 3. CheckIn и модель состояний

**CheckIn** — снимок самочувствия (опционален, но движет рекомендациями):
- `id`, `account_id`, `occurred_on` (дата в TZ юзера — см. R6), `mood?` (1..10), `energy?` (1..10), `pain?` (0..10), `sleep_hours?`, `anxiety?` (1..10), `focus?` (1..10), `note?`, `created_at`.
- Уникальность: один основной CheckIn на `(account, occurred_on)` (доп. возможны, но в дашборде берётся последний за день).

**UserState** — выводится из последнего CheckIn + активности (НЕ хранится как «правда», вычисляется доменным сервисом `StateResolver`):
- низкая энергия/высокая боль → `survival`/`recovery`; стабильно + рост активности → `growth`; явный спринт-режим (юзер включил) → `sprint`; пауза → `maintenance`.
- Состояние влияет на: число рекомендованных действий, показ минимальных версий, recovery-режим, автоснижение нагрузки.
- **Пауза-режим** (`paused`, болезнь/отпуск): флаг на аккаунте раздела (`accent_paused_from?`) — серии замораживаются, ролловер не наказывает.

> Доменный сервис `Recommender.nextActions(state, context)` → 1–3 микро-действия (survival → 2 PowerUp + 1 квест ≤5 мин; growth → больше Quest). Чистая функция над портами.

## 4. Goal (= Epic Win) + GoalEntry + Milestone

**Goal:**
- `id`, `account_id`, `title`, `whyItMatters?` (мотив-якорь), `domainKey?`, **`attributes[]`** (0..N — [ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)), `unit`, `targetValue` (numeric > 0), `deadline?` (date), `status` (`active|paused|completed|archived`), `completedAt?`, `fallbackVersion?` (текст: цель на плохой день), `pausedAt?`, `pauseHistory?` (jsonb `[{pausedAt,resumedAt}]`), `created_at`, `updated_at`.
- **Вычисляемые (на чтение):** `currentValue` = Σ GoalEntry.value; `percentage` = min(current/target·100, 100); `daysLeft`; `activeDays` (дни минус паузы); `pace` = current/activeDays; `forecast` (`ahead|on_track|behind|null`).
- **Инварианты:** `target>0`; при `current≥target` → авто-`completed` (видна, не удаляется), `completedAt` фиксируется один раз; `paused` не принимает GoalEntry и не участвует в forecast; entries при паузе не теряются; `archived` не в дашборде.

**GoalEntry:** `id`, `goal_id`, `value` (numeric ≠ 0; отрицательное = коррекция), `occurred_on` (date), `note?`, `created_at`. Несколько записей в день разрешены.

**Milestone (веха):** `id`, `goal_id`, `title`, `thresholdValue` (numeric, ≤ target), `reachedAt?`. При достижении порога — мини-достижение/награда (см. gamification). Веха неизменна после reached.

## 5. Habit / TaskTemplate → Task (+ разовые) + лесенка

**Habit (TaskTemplate):** `id`, `account_id`, `title`, `description?`, `icon?`, `domainKey?`, **`attributes[]`** (0..N, [ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)), `goalId?` (привязка к цели → выполнение даёт прогресс), `priority`, `kind` (`binary|quantitative|timed`), `recurrence` (RRULE), `isActive`, **`ladder`** (см. ниже), `minVersion?` (текст «минимум плохого дня»), `created_at`, `updated_at`.

**Лесенка (`ladder`)** — встроенный объект, ядро адаптивности ([ADR-0027](../../decisions/0027-accent-phase2-core.md) R2):
- `minTarget` — **минимальная победа** (для binary = 1 факт; для quantitative = напр. 1 повтор; для timed = напр. 60 сек).
- `currentTarget` — текущая «дневная цель» привычки.
- `goalTarget?` — желаемый потолок (напр. 100 отжиманий).
- `step?`, `policy` (`manual | adaptive`). При `adaptive`: N лёгких выполнений подряд → `currentTarget += step`; срыв/тяжело → откат к `minTarget` или ниже. Алгоритм — в `gamification.md`.

**Task** (инстанс на день): `id`, `account_id`, `templateId?` (null = разовая = Quest), `goalId?`, `title`, `occurred_on` (date), `kind`, `targetValue?` (снимок currentTarget на день), `doneValue?` (сколько фактически — частичное выполнение), `status` (`pending|done|partial|skipped`), `skipReason?` (`postponed|cancelled`), `postponedFromTaskId?`, `priority`, `category?` (для разовых), `deadline?` (для разовых), `completedAt?`, `created_at`.
- **Инварианты:** уник `(templateId, occurred_on)` где templateId не null — 1 инстанс/день; `done`/`partial` требует `doneValue` и `completedAt`; **`partial` при `doneValue ≥ minTarget` засчитывается как победа и держит серию**; `complete` идемпотентен; `uncomplete` → pending + revoke PointEvent; `postpone` → новый Task на завтра + текущий `skipped/postponed`.
- **Ролловер:** материализация Task из активных Habit по RRULE в **локальную полночь юзера** (нужен `timezone` — R6). День без материализации по RRULE серию не сбрасывает. В recovery/паузе ролловер мягкий (минимальные версии).

## 6. PowerUp (микро-победа)

Быстрое действие 10 сек–5 мин, доступное даже в плохой день — техническая форма «1 отжимание = победа».
- **PowerUp:** `id`, `account_id`, `title`, `category` (`physical|mental|emotional|social|sensory|household`), `durationSeconds` (≤ ~300), `energyCost` (1..3), `effect?`, `disabledForStates?` (UserState[]), `isActive`.
- **PowerUpLog:** `id`, `account_id`, `powerUpId`, `occurred_on`, `created_at` — факт выполнения (даёт очки, идемпотентно по `(powerUpId, occurred_on)` для дневного лимита).
- Стартовый набор создаётся при онбординге; в survival/recovery система рекомендует именно PowerUp.

## 7. AntiHabit + Relapse (timer-модель)

- **AntiHabit:** `id`, `account_id`, `title`, `description?`, `isActive`, `currentAttemptStartedAt` (unix ms), `attemptNumber` (≥1), `recordDays`, `recordAttemptStartedAt?`, `targetDays?` (цель, напр. 365). Серия = `floor((now − startedAt)/86_400_000)` (фронт считает в реальном времени).
- **AntiHabitRelapse:** `id`, `anti_habit_id`, `relapseAt` (unix ms), `attemptDurationMs`, `triggerTag?` (анализ триггеров срывов), `note?`, `created_at`.
- **Рецидив:** `startedAt=now`, `attemptNumber++`, рекорд обновляется если текущая серия > recordDays; milestone-очки на 3/7/14/30… планируются (отложенные задачи `@nestjs/schedule`), при рецидиве отменяются.

## 8. BadGuy + Counterplay (препятствие)

- **BadGuy:** `id`, `account_id`, `name`, `type?`, `trigger?`, `symptoms?`, `intensity` (1..5), `isActive`, `created_at`. (внутр. критик, прокрастинация, думскролл, недосып…)
- **Counterplay:** `id`, `bad_guy_id`, `text`, `linkedPowerUpId?` (контрмера может быть PowerUp). Помогает в момент столкновения.

## 9. Ally (союзник)

- **Ally:** `id`, `account_id`, `linkedAccountId?` (если союзник — пользователь из инвайт-дерева), `role` (`witness|supporter|accountability|emergency|coach`), `consentScope`, `note?`.
- В MVP — реестр/опора; полноценное соц-взаимодействие (видеть прогресс с согласия, совместные челленджи) — волна 2.1+ ([README §7](./README.md)). Связь с «кругом доверия» = инвайт-дерево Нормисов ([ADR-0002/0014](../../decisions/0002-invite-tree-adjacency.md)).

## 10. Недельный слой и журналы

- **WeeklyGoal** + **WeeklyGoalItem:** недельный фокус (`weekStart` = понедельник), чек-айтемы (`text`, `done`, `position`); уник `(account, weekStart, position)`. Сводка недели (лучший/худший день, средний %) — вычисляемая.
- **DailyMetric:** `id`, `account_id`, `occurred_on` (уник с account), `sleepHours?`, `energy?` (1..10), `mood?` (1..10), `note?`. Графики трендов 7/30/90.
- **DailyLesson** («урок-якорь»): `id`, `account_id`, `occurred_on` (уник), `content` (markdown), `tags[]`. Показывается, когда юзер не в ресурсе — его слова себе.

## 11. Геймификация (сущности; правила — в gamification.md)

- **PointEvent:** `id`, `account_id`, `source` (enum: task/goal_entry/powerup/anti_habit/streak_milestone/...), `sourceId`, `points`, `occurred_on`, `revokedAt?`. **Идемпотентность:** partial-unique `(source, sourceId) WHERE revokedAt IS NULL`.
- **Achievement** (каталог: `code` PK, title/desc/icon) + **UserAchievement:** `account_id`, `code`, `awardedAt`, `metadata?`; уник `(account, code)`.
- **Streak** — вычисляемая (on-demand window function; материализация — открытый R8).
- **Event-driven:** модуль геймификации подписан на доменные события (`task.completed`, `goal_entry.created`, `powerup.completed`, `anti_habit.held`, `milestone.reached`...) и начисляет награды; не дублирует прогресс.

## 12. Порты (application-слой)

`AccountAccentRepository` (настройки раздела, пауза, identity), `CheckInRepository`, `GoalRepository`/`GoalEntryRepository`/`MilestoneRepository`, `HabitRepository`/`TaskRepository`, `PowerUpRepository`, `AntiHabitRepository`, `BadGuyRepository`, `AllyRepository`, `WeeklyRepository`, `MetricRepository`/`LessonRepository`, `PointEventRepository`, `AchievementRepository`. Доменные сервисы: `StateResolver`, `Recommender`, `LadderEngine`, `StreakCalculator`, `GamificationListener`.

## 13. Открытые мелкие развилки (решить в gamification/api или под-ADR)

- **R6** ✅ РЕШЕНО ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)) — `timezone` добавлен платформенным полем в `accounts`; Акцент берёт из профиля ЛК.
- **R10** ✅ РЕШЕНО ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)) — и сфера (`domainKey`), и RPG-атрибуты (`attributes[]`) + паучья диаграмма баланса.
- **R8** — серии on-demand vs материализация (`streak_state`). Старт — on-demand.
- **R11** — формула XP/уровня (sqrt vs `100·N^1.5` + множитель серии) — в gamification.
- **R20/R21/R22** — Identity-развитие, accessibility-требования, AI-границы.
