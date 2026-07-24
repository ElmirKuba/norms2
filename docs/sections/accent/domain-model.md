# Акцент — доменная модель (Фаза 2)

> Сущности, поля, инварианты, состояния, механика лесенки. Каркас — [ADR-0027](../../decisions/0027-accent-phase2-core.md). Привязка к фундаменту — [README](./README.md). Геймификация — [`gamification.md`](./gamification.md). Схема БД/контракты — синтезируются на базе этого файла.
>
> **Слой:** бизнес-логика без прямого ORM — доступ к данным через adapters→repositories (5-слойка, [ADR-0030](../../decisions/0030-stack-revision-drizzle-5layer-npm.md), [архитектура](../../architecture.md)). Все id — `uuidv7___unixmillis` ([ADR-0016](../../decisions/0016-primary-key-format.md)). Все сущности принадлежат `accounts` фазы 1 через `account_id` (отдельного User нет). У всех — `created_at`/`updated_at`; мягкое удаление через `archived`/`deleted_at` по образцу фазы 1.

## 0. Карта связей

```
account (фаза 1)
 ├─ Identity            1:1   (игровая личность, развитие alias)
 ├─ CheckIn             1:N   (дневной снимок самочувствия → UserState; тренды 7/30/90)
 ├─ Goal                1:N   ── GoalEntry 1:N
 │    │                       └─ Milestone 1:N
 │    └─ под-Goal       (parent_goal_id; глубина из конфига ACCENT_GOAL_MAX_DEPTH)
 ├─ Domain(ref)         N     (сфера жизни — справочник + привязки)
 ├─ Habit (TaskTemplate)1:N   ── Task 1:N (материализация на день)
 ├─ Task (разовая)      1:N
 ├─ MicroWin            1:N   ── MicroWinLog 1:N
 ├─ AntiHabit           1:N   ── AntiHabitRelapse 1:N
 ├─ Obstacle            1:N   ── Counterplay 1:N
 ├─ Supporter           1:N   (опц. ссылка на account через инвайт-дерево)
 ├─ WeeklyGoal          1:N   ── WeeklyGoalItem 1:N
 ├─ DailyLesson         1:N   (uniq account+date)
 ├─ PointEvent          1:N   (идемпотентно)
 └─ Achievement(UserAchievement) 1:N
```

## 1. Value objects / перечисления

- **`Id`** — VO формата `uuidv7___unixmillis`.
- **`UserState`** = `survival | recovery | stability | growth | sprint | maintenance` (+ производные «перегружен/откатился» вычисляются, не хранятся). **Старт (реш. #3):** `StateResolver` начинает с упрощённого набора (`survival | stability | growth` + `paused`); полный список — поздний инкремент **без миграции** (UserState вычисляется, не хранится).
- **`DomainKey`** — сфера жизни: `health | sleep | sport | work | money | relationships | learning | home | creativity | purpose` (расширяемо; справочник, не жёсткий enum в БД).
- **`Attribute`** (RPG-прокачка, [ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)) — `strength | discipline | intellect | spirit | social | health` (расширяемо). Цель/привычка может прокачивать 0..N атрибутов → «паучья диаграмма» баланса + связь с Identity. Сфера (факт) и атрибуты (игра) — параллельны, не взаимоисключающи.
- **`HabitKind`** = `binary | quantitative | timed` (тип измерения выполнения) **+ `clock`** (целевое ВРЕМЯ суток / дедлайн — план 2.6.x, [ADR-0058](../../decisions/0058-habit-ladder-polarity-and-clock-kind.md)).
- **`LadderDirection`** = `raise | lower` (полярность лесенки, дефолт `raise` = «выше лучше»; `lower` = «ниже/раньше лучше» — план 2.6.x, [ADR-0058](../../decisions/0058-habit-ladder-polarity-and-clock-kind.md)).
- **`Priority`** = `low | normal | high | urgent`.
- **`ProgressUnit`** — свободная строка (`раз`, `км`, `страниц`, `мин`). Числа прогресса — `numeric`, не float.

## 2. Identity (игровая личность)

Развитие `alias` из ЛК — психодистанция «я не ленивый, я игрок в тяжёлом квесте».
- `account_id` (PK=FK, 1:1), `heroName?` (по умолчанию = alias), `archetype?`, `motto?`, `valuesText?`.
- Инвариант: не обязательна; отсутствие = используется `alias`. Не содержит ПДн (предупреждение на свободных полях).

## 3. CheckIn и модель состояний

**CheckIn** — **единый дневной снимок самочувствия** (опционален, но движет рекомендациями; поглощает бывш. `DailyMetric` — отдельной сущности метрик нет, реш. 2026-06-15):
- `id`, `account_id`, `occurred_on` (дата в TZ юзера — см. R6), `mood?` (1..10), `energy?` (1..10), `pain?` (0..10), `sleep_hours?`, `anxiety?` (1..10), `focus?` (1..10), `note?`, `created_at`.
- Уникальность: один основной CheckIn на `(account, occurred_on)` (доп. возможны, но в дашборде берётся последний за день).
- **Тренды самочувствия 7/30/90** строятся из CheckIn (графики mood/energy/sleep).

**UserState** — выводится из последнего CheckIn + активности (НЕ хранится как «правда», вычисляется доменным сервисом `StateResolver`):
- низкая энергия/высокая боль → `survival`/`recovery`; стабильно + рост активности → `growth`; явный спринт-режим (юзер включил) → `sprint`; пауза → `maintenance`.
- Состояние влияет на: число рекомендованных действий, показ минимальных версий, recovery-режим, автоснижение нагрузки.
- **Пауза-режим** (`paused`, болезнь/отпуск): флаг на аккаунте раздела (`accent_paused_from?`) — серии замораживаются, ролловер не наказывает.

> Доменный сервис `Recommender.nextActions(state, context)` → 1–3 микро-действия (survival → 2 MicroWin + 1 задача ≤5 мин; growth → больше задач). Чистая функция над портами.

## 4. Goal (цель) + GoalEntry + Milestone (+ подцели)

**Goal:**
- `id`, `account_id`, **`parentGoalId?`** (подцель — та же `Goal`; иерархия C+), `title`, `whyItMatters?` (мотив-якорь), `domainKey?`, **`attributes[]`** (0..N — [ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)), **`direction`** (`accumulate|reach|reduce` — род цели, [ADR-0052](../../decisions/0052-accent-goal-direction-and-computed-progress.md)), `unit`, `targetValue` (numeric), **`startValue?`** (базовый замер для reach/reduce; иммутабелен; null → база из первой записи), `deadline?` (date), `status` (`active|paused|completed|archived`), `completedAt?`, `fallbackVersion?` (текст: цель на плохой день), `pausedAt?`, `pauseHistory?` (jsonb `[{pausedAt,resumedAt}]`), `created_at`, `updated_at`. **Без `version`** — счётчиков не храним (агрегаты вычисляемы).
- **Род цели (`direction`, ADR-0052):** `accumulate` (накопление — сумма, «50 книг»), `reach` (выйти на уровень — последний замер, «15 подтягиваний»), `reduce` (снизить — `reach` с `target<start`, «курить 0»). От рода зависят формулы ниже.
- **Иерархия (C+, реш. 2026-06-15):** подцель = `Goal` с `parentGoalId`. **Глубина — из конфига** `ACCENT_GOAL_MAX_DEPTH` (env, дефолт `2` = 1 уровень подцелей), НЕ хардкод; инвариант домена читает конфиг → превышение = `GOAL_MAX_DEPTH_REACHED` (422). Дерево — для организации; ежедневный поток (`Recommender`) работает на листьях.
- **Вычисляемые (на чтение, ADR-0052):** `currentValue` (`accumulate`: Σ entries; `reach`/`reduce`: последний замер, иначе `startValue`); единая доля `f = clamp(...)` (`accumulate`: current/target; `reach`/`reduce`: (current−start)/(target−start)); `percentage = round(f·100)`; `daysLeft`; `activeDays` (дни минус паузы); `pace`; `forecast` (`ahead|on_track|behind|null`) и `projectedCompletionDate` — считаются **в пространстве доли `f`** (observedRate=f/activeDays vs requiredRate=(1−f)/daysLeft), едино для всех direction.
- **Rollup (ADR-0052):** у цели ЛИБО свои `GoalEntry`, ЛИБО подцели; есть активные подцели → `percentage` = **среднее % прямых детей** (равный вес); `currentValue` числом не показываем (единицы детей разнородны) — UI даёт %+«N из M подцелей выполнено».
- **Инварианты (ADR-0052):** `accumulate`: `target>0`; `reach`/`reduce`: `target≠startValue`; при `f≥1` → авто-`completed` (видна, не удаляется) через conditional-update `WHERE completed_at IS NULL` (идемпотентно, без version); `paused` не принимает GoalEntry и не участвует в forecast; entries при паузе не теряются; `archived` не в дашборде.

**GoalEntry:** `id`, `goal_id`, `value` (numeric ≠ 0; отрицательное = коррекция), `occurred_on` (date), `note?`, `created_at`. Несколько записей в день разрешены.

**Milestone (веха):** `id`, `goal_id`, `title`, `thresholdValue` (numeric, ≤ target), `reachedAt?`. При достижении порога — мини-достижение/награда (см. gamification). Веха неизменна после reached.

## 5. Habit / TaskTemplate → Task (+ разовые) + лесенка

**Habit (TaskTemplate):** `id`, `account_id`, `title`, `description?`, `icon?`, `domainKey?`, **`attributes[]`** (0..N, [ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)), `goalId?` (привязка к цели → выполнение даёт прогресс), `priority`, `kind` (`binary|quantitative|timed`), `recurrence` (RRULE), `isActive`, **`ladder`** (см. ниже), `minVersion?` (текст «минимум плохого дня»), `created_at`, `updated_at`.

**Лесенка (`ladder`)** — встроенный объект, ядро адаптивности ([ADR-0027](../../decisions/0027-accent-phase2-core.md) R2):
- `minTarget` — **минимальная победа** (для binary = 1 факт; для quantitative = напр. 1 повтор; для timed = напр. 60 сек).
- `currentTarget` — текущая «дневная цель» привычки.
- `goalTarget?` — желаемый потолок (напр. 100 отжиманий).
- `step?`, `policy` (`manual | adaptive`). При `adaptive`: N лёгких выполнений подряд → `currentTarget += step`; срыв/тяжело → откат к `minTarget` или ниже. Алгоритм — в `gamification.md`.
- `direction?` (`raise|lower`, дефолт `raise` — план 2.6.x, [ADR-0058](../../decisions/0058-habit-ladder-polarity-and-clock-kind.md)): при `lower` успех = `performed ≤ currentTarget`, планка двигается ВНИЗ, инвариант переворачивается (`goalTarget ≤ currentTarget ≤ minTarget`). Для `kind='clock'` цели/факт хранятся как **`anchorMinutes`** — минуты от вечернего якоря (midnight-safe).

**Task** (инстанс на день): `id`, `account_id`, `templateId?` (null = разовая задача, one-off), `goalId?`, `title`, `occurred_on` (date), `kind`, `targetValue?` (снимок currentTarget на день), `doneValue?` (сколько фактически — частичное выполнение), `status` (`pending|done|partial|skipped`), `skipReason?` (`postponed|cancelled`), `postponedFromTaskId?`, `priority`, `category?` (для разовых), `deadline?` (для разовых), `completedAt?`, `created_at`.
- **Инварианты:** уник `(templateId, occurred_on)` где templateId не null — 1 инстанс/день; `done`/`partial` требует `doneValue` и `completedAt`; **`partial` при `doneValue ≥ minTarget` засчитывается как победа и держит серию**; `complete` идемпотентен; `uncomplete` → pending + revoke PointEvent; `postpone` → новый Task на завтра + текущий `skipped/postponed`.
- **Ролловер:** материализация Task из активных Habit по RRULE в **локальную полночь юзера** (нужен `timezone` — R6). День без материализации по RRULE серию не сбрасывает. В recovery/паузе ролловер мягкий (минимальные версии).

## 6. MicroWin (микро-победа)

Быстрое действие 10 сек–5 мин, доступное даже в плохой день — техническая форма «1 отжимание = победа».
- **MicroWin:** `id`, `account_id`, `title`, `category` (ось модальности «какой сброс»: `physical|mental|emotional|social|sensory|household|digital|rest|spiritual|nature|boundaries`), `domainKey?` (опц. вторая ось — сфера жизни, общая со целями/привычками; ADR-0056, M#B3-1), `durationSeconds` (≤ ~300), `prepSeconds?` (опц. время на подготовку перед действием таймера; null/0 = без подготовки; M#B3-4), `energyCost` (1..3), `effect?`, `disabledForStates?` (UserState[]), `isActive`, `position`.
- **MicroWinLog:** `id`, `account_id`, `microWinId`, `occurred_on`, `created_at` — факт выполнения (даёт очки, идемпотентно по `(microWinId, occurred_on)` для дневного лимита).
- Стартовый набор создаётся при онбординге; в survival/recovery система рекомендует именно MicroWin.

## 7. AntiHabit + таймлайн событий (timer-модель)

> **Статус:** база (серия/рекорд/рецидив, CAS) — **реализована** (Трек C, 2.6.0, не задеплоена).
> Таймлайн событий, состояние `planned`, перенос/план и авто-эскалация цели — **план 2.6.1/2.6.2**
> ([ADR-0059](../../decisions/0059-anti-habit-timeline-events.md) события,
> [ADR-0060](../../decisions/0060-anti-habit-calendar-goal-ladder.md) лестница). Т.к. фича НЕ в проде —
> схема пересобирается до первого деплоя (relapse-only → события); прод relapse-only не увидит.

- **AntiHabit:** `id`, `account_id`, `title`, `description?`, `isActive`, `currentAttemptStartedAt` (unix ms), `attemptNumber` (≥1), `recordDays`, `recordAttemptStartedAt?`, `targetDays?`, `version` (CAS). Серия = `floor((now − startedAt)/86_400_000)` (фронт считает в реальном времени).
  - **Состояние `planned` (план, ADR-0059):** `currentAttemptStartedAt` может быть в БУДУЩЕМ → `now < startedAt` = серия ещё не идёт (счётчик показывает «старт через X», не тикает). Отдельной колонки нет — состояние вычисляемо. Реальный старт = когда наступит время.
  - **`targetDays` — семантика меняется (план, ADR-0060):** это не фикс-потолок, а **стартовая ступень** авто-лестницы. Цель = ближайший непройденный порог, вычисляемый как **ДАТА** (см. ниже).
- **AntiHabitEvent (таймлайн, ADR-0059):** единая лента событий вместо relapse-only. `id`, `anti_habit_id` (FK cascade), `type` (`relapse | reschedule | plan | goal_reached`), `occurredAt` (unix ms), `created_at` + типизированные nullable-поля:
  - `relapse`: `attemptDurationMs`, `endedAttemptNumber`, `triggerTag?`, `note?`;
  - `reschedule` / `plan`: `fromStartedAt?`, `toStartedAt?`, `heldDays?` (сколько продержался до переноса);
  - `goal_reached`: `thresholdLabel` (`неделя`/`месяц`/`год`/`+7д`…), `thresholdDays` (номинал в днях на момент достижения).
- **Рецидив (`type='relapse'`):** `startedAt=now`, `attemptNumber++`, `recordDays` обновляется если текущая серия > `recordDays`; пишется событие `relapse`. (Очки за вехи серий — 2.9, событийные хуки.)
- **Перенос/план (D2, план, ADR-0059):** старт двигается только **в будущее**. При создании — чекбокс «Начать не сегодня» → `plan` (старт в будущем, `planned`). Из идущей серии — «Перенести на будущее»: под CAS завершаем текущую попытку (событие `reschedule` c `heldDays`), ставим `currentAttemptStartedAt` в будущее. **Бэкфилл в прошлое НЕ поддерживается** (правка идущей в прошлое запрещена — «создай новую, старую удали»; UI-пасхалка «машина времени», D7).
- **Авто-эскалация цели (D3, план, ADR-0060):** лестница порогов от старта серии — `1·3·5·7(неделя)·14·21·+месяц·40д·50д·+2мес·+3мес·+полгода·+3квартала·+год → +7д «морковка» ∞`. Календарные пороги (месяц/год) — **зеркальное число** с клампом к концу месяца (старт 31.03 → «месяц» = 30.04). Цель = ближайшая пороговая ДАТА > now (в TZ аккаунта). Достиг → событие `goal_reached` + сдвиг на следующую ступень. Ручная `targetDays` = точка входа на лестницу, не потолок.
- **Инвариант (важно):** серия НЕ хранится — вычисляется из `currentAttemptStartedAt`. `recordDays` хранится **отдельно и переживает срыв** (лучшая попытка за всё время, рецидивом не обнуляется; `recordAttemptStartedAt?` — когда рекорд поставлен). Anti-burnout: одна осечка не стирает историю; авто-цель всегда даёт следующий маленький порог (без «финиша»).
- **Конкурентность:** рецидив/перенос идут под optimistic `version` на `anti_habits` (CAS, [ADR-0035](../../decisions/0035-concurrency-control.md)) — гонка разрешается (одна применяется, вторая перечитывает). Доменный гард `ALREADY_RELAPSED`: нельзя срыв неактивной/повторный в тот же момент.
- **События (хуки для 2.9):** `relapse` эмитит `anti_habit.relapsed`, «держится/веха» — `anti_habit.held` ([gamification §7](./gamification.md)). `anti_habit_events` = история для UI; порт эмита = хуки для очков (концерны разные, выровнены по типам). Слушателей/очков нет до 2.9.
- **ПДн:** `triggerTag`/`note`/`description` — свободные поля → подсказка «без реальных имён/телефонов/адресов» ([ADR-0001](../../decisions/0001-data-minimization-no-pii.md), ui-ux §9).

## 8. Obstacle + Counterplay (препятствие)

- **Obstacle:** `id`, `account_id`, `name`, `type?`, `trigger?`, `symptoms?`, `intensity` (1..5), `isActive`, `created_at`. (внутр. критик, прокрастинация, думскролл, недосып…)
- **Counterplay:** `id`, `obstacle_id`, `text`, `linkedMicroWinId?` (контрмера может быть MicroWin). Помогает в момент столкновения.

## 9. Supporter (поддержка / союзник)

- **Supporter:** `id`, `account_id`, `linkedAccountId?` (если союзник — пользователь из инвайт-дерева), `role` (`witness|supporter|accountability|emergency|coach`), `consentScope`, `note?`.
- В MVP — реестр/опора; полноценное соц-взаимодействие (видеть прогресс с согласия, совместные челленджи) — поздняя волна 2.13+ ([README §7](./README.md)). Связь с «кругом доверия» = инвайт-дерево Нормисов ([ADR-0002/0014](../../decisions/0002-invite-tree-adjacency.md)).

## 10. Недельный слой и журналы

- **WeeklyGoal** + **WeeklyGoalItem:** недельный фокус (`weekStart` = понедельник), чек-айтемы (`text`, `done`, `position`); уник `(account, weekStart, position)`. Сводка недели (лучший/худший день, средний %) — вычисляемая.
- **DailyLesson** («урок-якорь»): `id`, `account_id`, `occurred_on` (уник), `content` (markdown), `tags[]`. Показывается, когда юзер не в ресурсе — его слова себе.
- _Дневные метрики самочувствия (сон/энергия/настроение) и тренды 7/30/90 — это `CheckIn` (§3); отдельной `DailyMetric` нет (слита, реш. 2026-06-15)._

## 11. Геймификация (сущности; правила — в gamification.md)

- **PointEvent:** `id`, `account_id`, `source` (enum: task/goal_entry/micro_win/anti_habit/streak_milestone/...), `sourceId`, `points`, `occurred_on`, `revokedAt?`. **Идемпотентность:** partial-unique `(source, sourceId) WHERE revokedAt IS NULL`.
- **Achievement** (каталог: `code` PK, title/desc/icon) + **UserAchievement:** `account_id`, `code`, `awardedAt`, `metadata?`; уник `(account, code)`.
- **Streak** — вычисляемая (on-demand window function; материализация — открытый R8).
- **Event-driven:** модуль геймификации подписан на доменные события (`task.completed`, `goal_entry.created`, `micro_win.completed`, `anti_habit.held`, `milestone.reached`...) и начисляет награды; не дублирует прогресс.

## 12. Порты (application-слой)

`AccountAccentRepository` (настройки раздела, пауза, identity), `CheckInRepository` (вкл. тренды самочувствия), `GoalRepository`/`GoalEntryRepository`/`MilestoneRepository`, `HabitRepository`/`TaskRepository`, `MicroWinRepository`, `AntiHabitRepository`, `ObstacleRepository`, `SupporterRepository`, `WeeklyRepository`, `LessonRepository`, `PointEventRepository`, `AchievementRepository`. Доменные сервисы: `StateResolver`, `Recommender`, `LadderEngine`, `StreakCalculator`, `GamificationListener`.

## 13. Открытые мелкие развилки (решить в gamification/api или под-ADR)

- **R6** ✅ РЕШЕНО ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)) — `timezone` добавлен платформенным полем в `accounts`; Акцент берёт из профиля ЛК.
- **R10** ✅ РЕШЕНО ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)) — и сфера (`domainKey`), и RPG-атрибуты (`attributes[]`) + паучья диаграмма баланса.
- **R8** — серии on-demand vs материализация (`streak_state`). Старт — on-demand.
- **R11** — формула XP/уровня (sqrt vs `100·N^1.5` + множитель серии) — в gamification.
- **R20/R21/R22** — Identity-развитие, accessibility-требования, AI-границы.
- **Иерархия целей** ✅ РЕШЕНО (2026-06-15) — C+: подцель = `Goal` с `parentGoalId`, глубина из конфига `ACCENT_GOAL_MAX_DEPTH` (см. §4). **Rollup-формула** ✅ РЕШЕНА ([ADR-0052](../../decisions/0052-accent-goal-direction-and-computed-progress.md), 2.5·1): среднее % прямых детей.
- **Семантика значения цели** ✅ РЕШЕНО ([ADR-0052](../../decisions/0052-accent-goal-direction-and-computed-progress.md), 2.5·1) — `direction` (accumulate/reach/reduce) + `startValue`; все агрегаты вычисляемы (без `version`); forecast в едином пространстве доли `f`.
- **CheckIn↔DailyMetric** ✅ РЕШЕНО (2026-06-15) — слиты в единый `CheckIn` (§3), `DailyMetric` убрана.
