# Акцент — API-контракты (Фаза 2)

> REST раздела. Конвенции наследуем из фазы 1: префикс `/api/v1`, конверт ошибок `{ error: { code, message, details? } }`, zod-DTO (closed shape), access-JWT в `Authorization: Bearer`, id формата `uuidv7___unixmillis` ([ADR-0020](../../decisions/0020-api-conventions.md), [ADR-0016](../../decisions/0016-primary-key-format.md)). Сущности — [`domain-model.md`](./domain-model.md). Правила очков — [`gamification.md`](./gamification.md).
>
> Все эндпоинты — под `/api/v1/accent/...`, требуют аутентификации (раздел для авторизованных). Ресурс всегда принадлежит вызывающему `account` — чужой → `FORBIDDEN`.

## 0. Timezone (R6 — РЕШЕНО)
Ролловер задач и серии считаются по **локальной полуночи** пользователя → нужен часовой пояс. **Решение ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)):** `timezone` — **платформенное поле в `accounts`** (не в настройках раздела), редактируется в профиле ЛК. Акцент берёт TZ из профиля; `accent_settings.timezone` не существует.

## Общее
- **Формат дат:** `occurred_on` — `YYYY-MM-DD` (локальная дата юзера). Таймстампы — ISO `timestamptz`.
- **Коды ошибок** (поверх общих VALIDATION_FAILED/UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/RATE_LIMITED): `GOAL_PAUSED` (запись в цель на паузе), `LADDER_LOCKED` (повышение планки в recovery), `ALREADY_RELAPSED` и т.п.
- **Пагинация:** списки сущностей малы → массивы; длинные истории (goal-entries, point-events, relapses) — cursor `?limit=&cursor=` → `{ items, nextCursor }`.
- **Идемпотентность:** complete/uncomplete безопасны к повтору; очки — partial-unique (gamification §2).

---

## 1. Настройки раздела
- `GET /accent/settings` → `{ accentPausedFrom }` _(реализовано, 2.0.0)_; `overallStreakThreshold` добавится с сериями (2.9). timezone — в профиле ЛК, не здесь ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)).
- `PATCH /accent/settings` Body `{ overallStreakThreshold? }` → 200 _(в 2.9, когда появится поле; в 2.0.0 патчить нечего)_.
- `POST /accent/pause` / `POST /accent/resume` — пауза-режим (заморозка серий) → 204 _(реализовано, 2.0.0)_.

## 1a. Справочники (сферы, атрибуты)
- `GET /accent/domains` → `[{ key, title, … }]` — сферы жизни (`DomainKey`, подфаза 2.1; справочник, не enum в БД).
- `GET /accent/attributes` → `[{ key, title, … }]` — RPG-атрибуты ([ADR-0028](../../decisions/0028-accent-timezone-and-domains.md)); наполняют селекторы целей/привычек и `AttributeRadar`.
- Read-only для клиента (наполнение/сид — на бэке).

## 2. Identity
- `GET /accent/identity` → `{ heroName, archetype?, motto?, valuesText? }` (heroName по умолчанию = alias).
- `PUT /accent/identity` Body `{ heroName?, archetype?, motto?, valuesText? }` → 200 (предупреждение про ПДн на свободных полях).

## 3. CheckIn / состояние
- `POST /accent/checkins` Body `{ occurredOn, mood?, energy?, pain?, sleepHours?, anxiety?, focus?, note? }` → 201. Уник `(account, occurredOn)` — повтор обновляет (`PUT`-семантика upsert).
- `GET /accent/checkins?from&to` → массив.
- `GET /accent/checkins/trends?range=7|30|90` → тренды mood/energy/sleep. **CheckIn —
  единый дневной снимок** (бывш. DailyMetric слита сюда, реш. 2026-06-15); трендов из
  отдельных метрик нет.
- `GET /accent/state` → `{ state, basis }` — текущий UserState (вычисляется `StateResolver`).
- `GET /accent/recommendations` → `{ actions: [...] }` — 1–3 микро-действия по состоянию (`Recommender`).

## 4. Goals + Entries + Milestones
- `GET /accent/goals?status&domain` → массив (с вычисляемыми `currentValue/percentage/daysLeft/pace/forecast/projectedCompletionDate`; [ADR-0052](../../decisions/0052-accent-goal-direction-and-computed-progress.md)).
- `POST /accent/goals` Body `{ title, whyItMatters?, domainKey?, attributes?, parentGoalId?, direction, unit, targetValue, startValue?, deadline?, fallbackVersion?, fallbackMicroWinId? }` → 201. `fallbackMicroWinId` (2.7·H) — своя микро-победа как **версия цели на плохой день**: делает текст `fallbackVersion` нажимаемым. Чужая/несуществующая → `VALIDATION_ERROR` (400); удаление микро-победы обнуляет ссылку (SET NULL), цель и текст остаются. Тот же ключ принимает `PATCH`. `direction` ∈ `accumulate|reach|reduce` (ADR-0052); `startValue` — базовый замер для reach/reduce (иммутабелен; null → база из первой записи). `parentGoalId` → подцель (глубина ≤ `ACCENT_GOAL_MAX_DEPTH`, иначе `GOAL_MAX_DEPTH_REACHED` 422). Валидация: accumulate `targetValue>0`; reach/reduce `targetValue≠startValue` (иначе `VALIDATION_ERROR`).
- `GET /accent/goals/:id` → цель с прогрессом + **`fallbackAction`** `{ microWinId, title, durationSeconds, prepSeconds }` (2.7.2) — развёрнутая «версия на плохой день», всё для кнопки и таймера сразу, чтобы экран не тянул каталог микро-побед вторым запросом (зеркало `minAction` у задач). Нет привязки или микро-победа удалена → `null`. **Только на чтении одной цели**: в списке `GET /accent/goals` и в ответах мутаций поле `null` — там кнопка не рисуется.
  - Зачёт минимума идёт обычным `POST /accent/micro-wins/:id/complete`: **в прогресс цели он не попадает** осознанно (выйти на улицу — не километры пробежки; смысл в том, чтобы не разорвать связь с целью в плохой день, а не подкрутить процент).
- `PATCH /accent/goals/:id` · `POST /accent/goals/:id/archive` · `/restore`.
- `POST /accent/goals/:id/pause` · `/resume` (пауза не принимает entries).
- `POST /accent/goals/:id/entries` Body `{ value, occurredOn?, note? }` → 201. Ошибка `GOAL_PAUSED` (409). Триггерит прогресс + возможный `goal.completed`/`milestone.reached`.
- `GET /accent/goals/:id/entries?from&to` (cursor).
- `POST /accent/goals/:id/milestones` Body `{ title, thresholdValue }` · `GET .../milestones` · `DELETE .../milestones/:mid` (только не достигнутые).

## 5. Habits (TaskTemplate) + Tasks + лесенка
- `GET /accent/habits` · `POST /accent/habits` Body `{ title, description?, icon?, domainKey?, attributes?, goalId?, priority?, kind, recurrence, ladder:{minTarget,currentTarget,goalTarget?,step?,policy}, minVersion?, minVersionMicroWinId? }` → 201. `minVersionMicroWinId` (2.7·H) — своя микро-победа как **минимум на плохой день**: делает текстовую подсказку `minVersion` нажимаемой. Чужая/несуществующая → `VALIDATION_ERROR` (400); удаление микро-победы обнуляет ссылку (SET NULL), привычка и текст остаются.
- ✅ **Архив с возвратом (2.9.3·18, [ADR-0068](../../decisions/0068-deletion-belongs-to-storage.md)):** `GET /accent/habits?filter=active|archived` (умолчание — в работе), `POST /accent/habits/:id/archive` → 200, `POST /accent/habits/:id/restore` → 200. Оба перехода живут в одном use-case: пока двери в одном файле, нельзя сделать вход, забыв про выход — до 2.9.3 у всех четырёх списков «Акцента» был вход и не было выхода. Экрана удалённого нет и не будет: удалённое не отдаётся ни одним чтением.
  - **Полярность/время (план 2.6.x, [ADR-0058](../../decisions/0058-habit-ladder-polarity-and-clock-kind.md)):** `kind` допускает `clock`; `ladder` расширяется опц. `direction` (`raise|lower`, дефолт `raise`) и `anchorMinutes?` (для `clock` — минуты от вечернего якоря). Аддитивно, дефолт = текущее поведение; кросс-инвариант (`clock` требует якорь, `lower` переворачивает порядок целей) проверяет domain-service.
- `GET/PATCH /accent/habits/:id` · `POST /accent/habits/:id/deactivate` (мягко: `isActive=false` → уходит из материализации; **+ удаляет ещё не тронутые `pending`-задачи этой привычки**, `done`/`partial`/`skipped` оставляет ради истории — удаление шаблона намеренное).
- `POST /accent/habits/starter-pack` → засевает примеры-привычки (`is_starter=true`, дедуп по названию, только докидывает) → свежий список. `DELETE` → удаляет непринятые примеры → свежий список. **Инертная витрина (ADR-0051):** примеры видны в «Шаблонах» с бейджем, но НЕ материализуют задачи / не двигают лесенку до присвоения.
- `POST /accent/habits/:id/adopt` → «Добавить себе»: снимает `is_starter` (привычка начинает материализовать задачи). Adoption также при `PATCH` (редактирование).
- `GET /accent/tasks?date=YYYY-MM-DD` → задачи дня (материализованные + разовые). У задачи из привычки с привязанным «минимумом на плохой день» (2.7·H) приходит **`minAction`** `{ microWinId, title, durationSeconds, prepSeconds }` — всё нужное для кнопки и таймера сразу, чтобы карточка не тянула каталог микро-побед вторым запросом; иначе `null`.
- `GET /accent/tasks/overdue` · `GET /accent/tasks/due-today` (для разовых с deadline).
- `POST /accent/tasks` Body `{ title, occurredOn, kind, targetValue?, category?, deadline?, priority? }` → разовая (one-off).
- `POST /accent/tasks/:id/complete` Body `{ doneValue?, replace? }` → **`{ task, ladderEvent }`** (done/partial, идемпотентно).
  - **Защита от тихого понижения (2.7.1):** если `doneValue` **меньше** уже записанного, запись проходит только с явным `replace: true`; иначе → **`409 TASK_VALUE_DOWNGRADE`** (тело — обычный конверт ошибки; актуальное состояние фронт перечитывает сам). Зачем: вкладка с устаревшими данными (отметил с телефона, на десктопе висит старое) молча перезаписывала результат — «100 приседаний» превращались в «60», и потери не видел никто. Легальное понижение ровно одно — «Начать сначала» в таймере, оно и шлёт флаг. Для `clock`-привычек полярность обратная (раньше = лучше), поэтому «понижением» там считается **рост** значения. Накопительный сценарий (значение **больше**) работает как раньше, без флага. `ladderEvent` = `'raised' | 'lowered' | null` — движение адаптивной планки для фидбэка («планка выросла / сегодня мягче»; null = нет движения / manual / разовая). `partial≥minTarget` держит серию; триггерит `LadderEngine`.
  - **Таймер `timed`-привычки (Трек A / FEAT-H1, план `2.6.x`):** завершение фокус-таймера = зачёт через **этот же** эндпоинт с `doneValue = отсчитанные секунды` (обычно = `ladder.currentTarget`, но зачитывается по факту); отмена/сброс таймера — **без** вызова (ничего не пишет). **Нового эндпоинта/поля не требуется** — таймер целиком фронтовый поверх существующего контракта.
- `POST /accent/tasks/:id/complete-minimum` → `{ task, microWinNewlyCompleted }` (2.7·H, **«сделал минимум»**): в одной транзакции пишет лог привязанной микро-победы и закрывает задачу как `partial` со значением `ladder.minTarget`. **Лесенка не двигается** — минимум это не успех и не провал, а «удержался»; `≥ minTarget` держит серию. Идемпотентно (`updateIfOpen`): повтор не пишет второй лог и не понижает уже взятый полный зачёт. Ошибки: `VALIDATION_ERROR` (400) — у разовой задачи минимума нет, у привычки не задан `minVersionMicroWinId`.
- `POST /accent/tasks/:id/uncomplete` → pending + revoke очков.
  - **Только сегодняшняя задача (2.7.3):** отмена чужого дня → `400 VALIDATION_ERROR` («Отменить можно только сегодняшнюю отметку»). Отменить можно ровно то, что видно в «Сегодня»; ответственность за прошлое остаётся у человека — продукт не переписывает историю. Технически это же снимает засаду отката: возврат **не последней** отметки стёр бы все последующие движения планки.
  - **Планка возвращается (2.7.3):** `complete` кладёт на строку задачи снимок лесенки «как было до» (`ladder_before`: `currentTarget`/`easyStreak`/`missStreak`) — но только если реально её двигал; `uncomplete` применяет снимок через тот же CAS и гасит его. Отменил отметку — значит её не было. Нет снимка (минимум, ручная лесенка, разовая задача) — возвращать нечего, и это норма. **Наружу снимок не отдаётся** — внутренняя механика.
- **`GET /accent/habits/:id/history?before=YYYY-MM-DD&limit=30` (2.7.3)** → история конкретной привычки для экрана «что было с этой привычкой». *(Пишется до кода; будет приведён к факту при реализации.)*
  - **Эндпоинт НИЧЕГО НЕ СОЗДАЁТ.** Читает `habit_tasks` напрямую и **не зовёт `ensureTasksForDay`** — в отличие от `GET /accent/tasks`, который материализует запрошенный день. Иначе просмотр истории родил бы строки за прошлые дни, причём с **сегодняшней** планкой вместо тогдашней, и необратимо исказил бы прошлое. «Запрашиваем историю, а не создаём её» (реш. Elmir 2026-08-01).
  - Ответ: `{ items: HabitHistoryDay[], nextCursor: string | null, lastMarkedOn: string | null, daysSinceLastMark: number | null }`. **Счётчика пропусков в ответе нет намеренно** — его посчитали по плану, но решение о тоне сделало ненужным: показываем «последняя отметка N дней назад», а не «пропущено N дней». Поймал `make audit-fields`; поле убрано, а не пристроено.
  - `HabitHistoryDay` = `{ occurredOn, event, doneValue, targetValue, completedAt, postponedTo, isToday, ladderMove }`, где `event` ∈ `done | partial | postponed | pending`:
    - **`postponed`** — склейка двух строк в одну: сегодняшняя `skipped/postponed` + завтрашняя копия отдаются **одним объектом** с `postponedTo` = дата переноса. Сборка на бэке: фронт не должен разгребать сырьё.
    - **`pending`** — «ожидает внимания»; `isToday` показывает, имеет ли смысл кнопка «В „Сегодня“» (для прошлых дней задача там не появится).
    - **`ladderMove`** = `{ from, to } | null` — движение планки, восстановленное по изменению `targetValue` между соседними днями (снимок `ladder.currentTarget` на день). Показываем **факт** («12 июля: 8 → 10»), механику («ещё один успех — поднимется») наружу не отдаём: это приглашение играть с планкой.
  - **Статуса `missed` в системе нет и не заводим.** Отсутствие дня в ленте — просто отсутствие; счётчиков пропусков наружу нет. Тон — «последняя отметка N дней назад», не «пропущено N дней».
  - **Будущее в историю не попадает:** заранее материализованный день или завтрашняя копия переноса отсекаются — это ещё не то, что было.
  - Пагинация — **keyset** по `occurredOn desc` (`before` — исключающий курсор), `limit` по умолчанию 30, максимум 90. Offset не используем: он поедет при вставках.
  - Пример-витрина (`is_starter`, [ADR-0051](../../decisions/0051-starter-habits-inert-showcase.md)) истории иметь не может — задачи из него не материализуются; ответ будет пустым, и экран честно скажет «показать пока нечего».
  - Чужая/несуществующая привычка → `TASK_NOT_FOUND`-семантика владения, как везде в разделе.
- **`updated_at` у задачи (2.7.1):** колонка ведётся с этого патча (раньше у `habit_tasks` (тогда `tasks`) был только `created_at`) — для диагностики и будущих сценариев свежести. Наружу отдаётся в `TaskView`.
- `POST /accent/tasks/:id/postpone` → новый Task на завтра, текущий `skipped/postponed`.
- **`POST /accent/tasks/:id/unpostpone` (2.7.2)** → откат переноса: задача снова `pending`, завтрашняя копия удаляется. Возвращает вернувшуюся задачу.
  - **Зачем:** перенос был единственным необратимым действием раздела — и делается он в худшем состоянии человека. Отметку выполнения отменить можно было всегда, а «сегодня не могу» — нельзя; раздел, обещающий «плохой день не отменяет прогресс», не должен фиксировать плохой день окончательно.
  - **Границы:** только `skipped` со `skipReason='postponed'` (иначе `400 VALIDATION_ERROR`, «Эта задача не переносилась») и только **сегодняшняя** задача по таймзоне аккаунта (иначе `400`, «Вернуть можно только сегодняшний перенос») — воскрешать позавчерашние переносы значило бы переписывать историю.
  - **Завтрашняя копия** удаляется, только если родилась именно из этого переноса (`postponedFromTaskId`) и её никто не трогал (`pending`, без `doneValue`); тронутую оставляем — там уже чужой результат. Для ежедневной привычки удаление безопасно: материализация создаст задачу завтра заново по расписанию.
  - Удаление копии и возврат исходной идут **в одной транзакции**. Лесенка не двигается — перенос её не двигал.

## 6. MicroWins (микро-победы)
- `GET /accent/micro-wins` · `POST /accent/micro-wins` Body `{ title, category, domainKey?, durationSeconds, prepSeconds?, energyCost, effect?, disabledForStates? }`. `category` — ось модальности (обяз.); `domainKey` — опц. сфера жизни (вторая ось, общая со целями/привычками; ADR-0056, M#B3-1); `prepSeconds` — опц. время на подготовку перед действием таймера (0..300; null/0 = без подготовки; M#B3-4).
- ✅ **Архив с возвратом (2.9.3·18, [ADR-0068](../../decisions/0068-deletion-belongs-to-storage.md)):** `GET /accent/micro-wins?filter=active|archived` (умолчание — в работе), `POST /accent/micro-wins/:id/archive` → 200, `POST /accent/micro-wins/:id/restore` → 200. Оба перехода живут в одном use-case: пока двери в одном файле, нельзя сделать вход, забыв про выход — до 2.9.3 у всех четырёх списков «Акцента» был вход и не было выхода. Экрана удалённого нет и не будет: удалённое не отдаётся ни одним чтением.
- `PATCH/DELETE /accent/micro-wins/:id`.
- `POST /accent/micro-wins/:id/complete` Body `{ occurredOn? }` → 201 (дневной лимит на 1 MicroWin; даёт очки).

## 7. AntiHabits («держусь»)
> Статус: **реализовано (Трек C 2.6.0 + доработки 2.6.1/2.6.2)** — под AuthGuard, per-account; в
> коде на dev, деплой бандлем. Модель событий — ADR-0059, авто-цель — ADR-0060, стартер-пак —
> ADR-0051. `AntiHabitView` отдаёт `currentAttemptStartedAt` (unix ms — фронт считает серию вживую),
> снимок `currentDays`, `attemptNumber`, `recordDays` (переживает срыв), `recordAttemptStartedAt`,
> `targetDays`, `isActive`, `state` (`active|planned`), `isStarter` (пример-витрина, ADR-0051) и
> `nextGoal` (следующий порог авто-цели: `{ label, thresholdDays, targetDate }`, вычисляется на чтение).
- `GET /accent/anti-habits?filter=active|archived` → `AntiHabitView[]` (по умолчанию **в работе**, включая примеры; `archived` — архив) · `POST` Body `{ title, description?, targetDays?, startAt? }` → `AntiHabitView` (201; без `startAt` — старт сейчас; `startAt` в ПРОШЛОМ/сейчас → серия уже идёт (`active`) — перенос с другого приложения; `startAt` в БУДУЩЕМ → `planned` + событие `plan`). `startAt` — любой положит. unix-ms (при создании прошлое разрешено, в отличие от `/reschedule`).
- ✅ `POST /accent/anti-habits/:id/archive` → 200 `AntiHabitView` — **в архив**: пропадает из списка «в работе», серия не идёт, рецидив не принимается. `POST /accent/anti-habits/:id/restore` → 200 — **обратно в работу**. Оба перехода живут в одном use-case намеренно: пока двери в одном файле, нельзя сделать вход, забыв про выход (до 2.9.3 ровно это и было — «убрать из списка» без возврата).
- ✅ `DELETE /accent/anti-habits/:id` → 204, повтор → 404. **Для человека безвозвратно**, и текст подтверждения обязан говорить это прямо: то, что хранилище оставляет строку у себя ([ADR-0068](../../decisions/0068-deletion-belongs-to-storage.md)), — наша страховка на случай аварии, а не его возможность. Удалённая анти-привычка не отдаётся **ни одним** чтением, включая `?filter=archived`.
- `GET /accent/anti-habits/:id` → `AntiHabitView` · `PATCH /accent/anti-habits/:id` Body `{ title?, description?, targetDays?, isActive? }` (`isActive` — низкоуровневый способ того же перехода; предпочитать `/archive` и `/restore`) → `AntiHabitView`. **Дату старта PATCH НЕ меняет** (в прошлое нельзя, D7-пасхалка; в будущее — через `/reschedule`). Правка примера (`is_starter`) присваивает его (adoption).
- `POST /accent/anti-habits/starter-pack` → засевает примеры «держусь» (`is_starter=true`, дедуп по названию, только докидывает) → свежий `AntiHabitView[]`. `DELETE` → удаляет непринятые примеры → свежий список. **Инертная витрина (ADR-0051):** пример виден с бейджем, но серия/авто-цель не считаются и рецидив/перенос недоступны (→ 400) до присвоения.
- `POST /accent/anti-habits/:id/adopt` → «Добавить себе»: снимает `is_starter` и стартует серию заново с этого момента → `AntiHabitView`.
- `POST /accent/anti-habits/:id/relapse` Body `{ triggerTag?, note?, obstacleId? }` (`obstacleId` — препятствие из своего списка, 2.7/ADR-0062 п.9; чужое/несуществующее → `OBSTACLE_NOT_FOUND` 404; в ответном событии поле `obstacleId`) → `{ antiHabit: AntiHabitView, event: AntiHabitEventView }` (сброс таймера, обновление рекорда, запись события `relapse`; фронт обновляет карточку+историю без перезапроса). Ошибка **`ALREADY_RELAPSED` (409)** — срыв неактивной / повторный в тот же момент; **`VALIDATION_ERROR` (400)** — срыв примера (сначала «Добавить себе»). CAS-first по `version` (ADR-0035): при успехе пишется событие, при конкурентном срыве — 409 без «висячего». Эмитит `anti_habit.relapsed` (хук 2.9).
- `POST /accent/anti-habits/:id/reschedule` Body `{ startAt }` (только будущее) → `{ antiHabit, event: AntiHabitEventView }` (завершает текущую попытку под CAS, событие `reschedule` c `heldDays`, старт → `planned`). Ошибка `INVALID_START_DATE` (400) если `startAt` не в будущем; `VALIDATION_ERROR` (400) для примера.
- `GET /accent/anti-habits/:id/events?cursor=&limit=` → `{ items: AntiHabitEventView[], nextCursor }` (новые→старые; keyset по `(occurredAt, id)`, непрозрачный base64url; `limit` 1..100, дефолт 30). **На первой странице лениво материализует достигнутые пороги авто-цели** (события `goal_reached`, ADR-0060; для примера — нет). `AntiHabitEventView`: `{ id, type, occurredAt, ...типо-специфичные поля }` (`relapse`: `attemptDurationMs`/`endedAttemptNumber`/`triggerTag?`/`note?`; `reschedule|plan`: `fromStartedAt?`/`toStartedAt?`/`heldDays?`; `goal_reached`: `thresholdLabel`/`thresholdDays`).
- **Ошибки:** `ANTI_HABIT_NOT_FOUND` (404), `ALREADY_RELAPSED` (409), `VALIDATION_ERROR` (400), `INVALID_START_DATE` (400).

## 8. Obstacles + Counterplays + Encounters
> Статус: **реализованы препятствия, контрмеры и журнал столкновений** (блоки B/C/D, 2.7·6–·19); стартовый пак (блок F) — **📋 план**. Всё под `AuthGuard`, скоуп по аккаунту из Guard ([ADR-0062](../../decisions/0062-accent-obstacles-model.md)).
> `ObstacleView` = `{ id, name, type, domainKey, trigger, symptoms, intensity, isActive, isStarter, position, createdAt }`. `accountId`/`version` наружу не отдаются: колонка `version` ведётся и bump'ается при каждом update, но строгий CAS для препятствий не включён (ADR-0035, уточнение — включаем там, где гонка реальна).
> **Вычисляемые на чтение** (хранимых счётчиков нет, ADR-0052): `counterplaysCount` и `encountersLast30` («мешал N раз за 30 дней») — во view препятствия; `helpedCount`/`ratedCount` («помогало N из M») — во view контрмеры. Записи без `outcome` в знаменатель **не идут**; `partly` попадает в знаменатель, но не в числитель — чтобы не преувеличивать.
> **`softLimitExceeded` — свойство списка, а не карточки**, поэтому `GET /accent/obstacles` отдаёт объект `{ items, softLimitExceeded }`, а не голый массив (прецедент обёртки — `{ items, nextCursor }` в §7).

**Препятствия**
- `GET /accent/obstacles` → `{ items: ObstacleView[], softLimitExceeded: boolean }` (по `position`, затем `created_at`, тай-брейкер `id`; активные + примеры) · `POST` Body `{ name, type, domainKey?, trigger?, symptoms?, intensity? }` → `ObstacleView` (201). `type` — обязателен, из словаря (`inner_critic|avoidance|distraction|body|emotion|people|environment|perfectionism`); `intensity` 1..5 (дефолт 3).
- ✅ **Архив с возвратом (2.9.3·18, [ADR-0068](../../decisions/0068-deletion-belongs-to-storage.md)):** `GET /accent/obstacles?filter=active|archived` (умолчание — в работе), `POST /accent/obstacles/:id/archive` → 200, `POST /accent/obstacles/:id/restore` → 200. Оба перехода живут в одном use-case: пока двери в одном файле, нельзя сделать вход, забыв про выход — до 2.9.3 у всех четырёх списков «Акцента» был вход и не было выхода. Экрана удалённого нет и не будет: удалённое не отдаётся ни одним чтением.
- `GET /accent/obstacles/:id` → `ObstacleView` (контрмеры с действенностью добавятся в блоке C) · `PATCH` Body `{ name?, type?, domainKey?, trigger?, symptoms?, intensity?, isActive? }` (`isActive` — низкоуровневый способ того же перехода; предпочитать `/archive` и `/restore`; правка примера присваивает его — adoption) · `DELETE` (контрмеры и журнал уносит **наш** каскад, а не база — [ADR-0068](../../decisions/0068-deletion-belongs-to-storage.md); ссылки из `anti_habit_events` остаются и проверяются читателем).
- `PUT /accent/obstacles/reorder` Body `{ ids }` → 204 ([ADR-0054](../../decisions/0054-tracker-manual-reorder-dragdrop.md); маршрут объявляется **до** `:id`).
- **Мягкий фокус-лимит:** при активных > `ACCENT_OBSTACLE_SOFT_LIMIT` (env, дефолт 7) список несёт `softLimitExceeded: true` → фронт показывает подсказку. **Создание не блокируется** (как фокус-лимит целей); считаются только свои активные — примеры-витрины в порог не входят. Отказ возможен лишь по жёсткому пределу 200 препятствий (`VALIDATION_ERROR`).

**Контрмеры**
- `GET /accent/obstacles/:id/counterplays` → `CounterplayView[]` = `{ id, obstacleId, text, linkedMicroWinId, position, helpedCount, ratedCount, createdAt }` (по `position` — **порядок ручной, по действенности не пересортировывается**) · `POST` Body `{ text, linkedMicroWinId? }` → `CounterplayView` (201; `linkedMicroWinId` валидируется через domain-service микро-побед — существует и принадлежит аккаунту, иначе `VALIDATION_ERROR`).
- `PATCH/DELETE /accent/obstacles/:id/counterplays/:cid` · `PUT /accent/obstacles/:id/counterplays/reorder` Body `{ ids }` → 204.

**Журнал столкновений**
- `POST /accent/obstacles/:id/encounters` Body `{ counterplayId?, outcome?, note?, occurredAt? }` → `{ encounter, obstacle }` (201; карточка приходит с пересчитанными агрегатами — фронту не нужен второй запрос ради цифры). **Все поля опциональны:** без `counterplayId` — «просто отметить», `outcome` можно проставить позже, `occurredAt` (unix ms) допускает отметку задним числом. Чужая/несуществующая контрмера → `VALIDATION_ERROR` (400). Для примера (`isStarter`) → `VALIDATION_ERROR` (400, инертная витрина, [ADR-0051](../../decisions/0051-starter-habits-inert-showcase.md)).
- `GET /accent/obstacles/:id/encounters?cursor=&limit=` → `{ items: ObstacleEncounterView[], nextCursor }` (новые→старые, keyset по `(occurredAt, id)`, непрозрачный base64url; `limit` 1..100, дефолт 30). `ObstacleEncounterView` = `{ id, obstacleId, occurredAt, counterplayId, outcome, note }`. **Битый/протухший курсор → первая страница, а не ошибка** (курсор не должен ломать экран).
- `PATCH /accent/obstacles/:id/encounters/:eid` Body `{ outcome }` → `ObstacleEncounterView` — проставить исход **позже** (единственный modify в append-only журнале; `outcome ∈ helped|partly|no`). Снятие оценки не предусмотрено: «не отмечено» и так не считается негативом.

**Стартовый пак** (инертная витрина, ADR-0051)
- `POST /accent/obstacles/starter-pack` → засевает примеры с готовыми контрмерами (`is_starter=true`, дедуп по названию) → свежий `ObstacleView[]` · `DELETE` → удаляет непринятые примеры.
- `POST /accent/obstacles/:id/adopt` → «Добавить себе»: снимает `is_starter` (маршрут — до `:id`-паттернов).

- **Ошибки:** `OBSTACLE_NOT_FOUND` (404), `COUNTERPLAY_NOT_FOUND` (404), `ENCOUNTER_NOT_FOUND` (404), `VALIDATION_ERROR` (400). `CONCURRENT_MODIFICATION` (409) появится, если для препятствий включат строгий CAS — сейчас `version` только ведётся ([ADR-0035](../../decisions/0035-concurrency-control.md)).

## 9. Supporters (MVP — реестр)
- `GET/POST /accent/supporters` Body `{ linkedAccountId?, role, consentScope, note? }` · `PATCH/DELETE`.
- _Соц-взаимодействие (видеть прогресс с согласия, совместные челленджи) — поздняя волна 2.13+._

## 9а. Списки дел и события (2.10)

- `GET /accent/todos?kind=deed|idea|purchase&archived=1` → корневые записи с **вложенными
  подзадачами** (дерево собирает сервер: экран не должен делать запрос на каждую строку).
  Неизвестный `kind` трактуется как `deed` — список не место для ошибок валидации.
- `POST /accent/todos` — **обязателен только `title` и `kind`**; `parentId`, `note`, `plannedOn`,
  `waitsForEventId`, `waitsUntil`, `badge` — по желанию.
- `PATCH /accent/todos/:id` — частичный патч. **`parentId` в патч не входит:** переезд подзадачи к
  другому родителю — отдельная операция со своими правилами (глубина, циклы), а не поле формы.
- `POST /accent/todos/:id/complete` · `/uncomplete` · `/archive` · `/restore`;
  `DELETE /accent/todos/:id` (подзадачи уходят каскадом); `PUT /accent/todos/reorder`
  (объявлен **до** маршрутов с `:id`, иначе «reorder» читается как идентификатор).
- `GET /accent/todo-events?happened=1` · `POST /accent/todo-events` ·
  `PATCH /accent/todo-events/:id` · `POST /accent/todo-events/:id/happened` · `/unhappened` ·
  `DELETE /accent/todo-events/:id`.
  - **`/happened` возвращает `{ event, released }`** — сколько дел освободилось. Фронт говорит
    человеку следствие числом, а не оставляет догадываться.

## 10. Недельный слой и журналы
- ~~`GET/POST/DELETE /accent/weekly-goals`~~, ~~`PATCH /accent/weekly-goals/:id`~~ — **отменены**
  ([ADR-0069](../../decisions/0069-week-is-a-horizon-not-a-list.md)): недельного планера нет, писать
  нечего.
- ~~`GET /accent/weekly-stats?week=YYYY-Www`~~ — **отдельного эндпоинта не заводим.** Недельный
  обзор задуман блоком **внутри `GET /accent/dashboard`** (§12), но **снят из подфазы 2.10
  15.08.2026** и переехал в 2.17 «Метрики туду»: плотность дня, посчитанная по одним привычкам,
  устареет с приходом дел и покупок. Когда появится — **без общей оценки недели** и **без
  сравнения с прошлой неделей** (обе — оценка человека, а не информация).
- `GET/PUT /accent/lessons?date=YYYY-MM-DD` (урок-якорь). `GET /accent/lessons?tag=`.
- _(Дневные метрики самочувствия — это `CheckIn` (§3), отдельного `/accent/metrics` нет — слили.)_

## 11. Геймификация / статистика
- `GET /accent/stats` → `{ totalXP, level, nextLevelXP, currentStreaks, longestStreaks, recentAchievements }`.
- `GET /accent/achievements` → каталог + выданные (`awardedAt|null`).
- `GET /accent/point-events?cursor` — история начислений (для прозрачности).

## 12. Dashboard (агрегатор)
**`GET /accent/dashboard` (2.11)** → всё для главного экрана **за один запрос**: согласованный снимок дня, один поход по сети (на мобильном это заметно). Серверная агрегация ([ADR-0019](../../decisions/0019-backend-architecture-conventions.md)); use-case собирает через domain-services соседних областей — кросс-домен **вниз**. *(Пишется до кода; будет приведён к факту при реализации.)*

- **Дашборд — это вход в день, поэтому он МАТЕРИАЛИЗУЕТ задачи дня** (тот же путь, что `GET /accent/tasks`). Осознанно противоположно истории привычки (§5, `/habits/:id/history`), которая читает прошлое и не создаёт ничего: открыть сегодняшний день — нормальная причина его создать, открыть прошлый — нет.
- Ответ:

```
{
  now: { kind, title, taskId, microWinId },   // герой «Сейчас»
  today: { total, done, percent, items: [{ id, title, status }] },
  goals: [{ id, title, percentage, isFocus }],
  antiHabits: [{ id, title, currentAttemptStartedAt }],
  overdue: [{ id, title, deadline }],
  hasObstacles: boolean,
  persistence: { totalDays, windowDays, windowSize, lastActiveOn, returnCount,
                 lastReturnSilenceDays, silenceDays },   // 2.9
  freshAchievement: { code, title, context } | null,     // 2.9·14
  freshMilestone: { antiHabitId, title, label } | null,  // 2.9·15
  onboarding: { hasHabits, hasGoals, hasFirstCompletion },
  pausedFrom: string | null
}
```

- **`now` — герой экрана, считается ПО ПРАВИЛАМ** (rule-based, [ADR-0063](../../decisions/0063-no-llm-in-critical-path.md)), первый сработавший побеждает:
  1. `overdue` — есть просроченная разовая задача с дедлайном;
  2. `task` — есть незакрытая задача дня;
  3. `micro_win` — день закрыт, но есть невыполненная сегодня микро-победа;
  4. `all_done` — на сегодня всё (`title` = null; экран хвалит и не выдумывает дело).
  - **Чек-ин (2.8) не добавит сюда блок — он уточнит выбор** внутри этого же механизма: при низкой энергии первым пойдёт минимум, а не полная задача. Контракт от этого не меняется.
- `today.items` — короткий список (до 5), полный чеклист живёт на `/accent/habits`. `goals` — фокусные первыми, до 5. `antiHabits` отдаёт **момент старта попытки**, а не число дней: счётчик тикает на фронте, как на экране «Держусь».
- `onboarding` — три флага под чек-лист пустого экрана: завёл привычку → отметил хоть раз → поставил цель. Все три `true` — чек-лист исчезает.
- `persistence` (2.9) — пара чисел постоянства для плитки: **итог** «дней с действием» (`totalDays`, не падает никогда) и **окно** `windowDays` из `windowSize` последних дней (восстанавливается само). Разбор по привычкам и витрина всех достижений на дашборд не идут — они на `/accent/stats`.
- `freshAchievement` (2.9·14) — достижение, полученное **не позже двух дней назад**, иначе `null`. Граница с `/accent/stats` проходит не по типу данных, а по вопросу, на который отвечает экран: дашборд — «что сейчас», статистика — «каким был путь». Поэтому сюда попадает **событие, которое исчезает само**, а не счётчик «3 из 6»: постоянно висящая витрина наград превратила бы вход в день в разглядывание прошлого.
  - **Побочный, но главный эффект:** выдачу достижений и вехи «держусь» дашборд **догоняет сам** (тот же ленивый `sync`, что на статистике). До 2.9·14 награды начислялись только тем, кто заходил на `/accent/stats`, — то есть человек мог не получить ни одной, просто не открыв вкладку.
- `freshMilestone` (2.9·15) — рубеж «держусь», пройденный не позже двух дней назад, иначе `null`. **Одна веха, старшая:** догнав за один заход 1/3/5/7 дней, человек видит «неделю», а не четыре строки об одном и том же. Читается из журнала (`anti_habit_events.goal_reached`), а не из результата материализации: веха, записанная вчерашним заходом, обязана показаться и сегодня, иначе второй визит за день оставил бы экран пустым.
- `persistence.silenceDays` рисуется на дашборде строкой «последняя отметка N дней назад» **при N > 1**: это не витрина прошлого, а повод вернуться. Про «сегодня» и «вчера» молчим — человек и так знает, а строка на один пропущенный день читается упрёком.
- **Чего в снимке пока нет** (придёт со своими подфазами, дашборд аддитивен): `state`/`recommendations` и быстрый чек-ин — 2.8; `week` (donut/бары/лучший-худший) — 2.10; тренды самочувствия — 2.8. XP и уровень **не придут вовсе** в среднем варианте — они отложены в часть 2 ([паспорт фичи](./gamification-passport.md)).

### 12.1. Статистика (2.9)

**`GET /accent/stats`** → постоянство и достижения одним снимком. Под `AuthGuard`, ресурс владельца.

```
{
  persistence: { totalDays, windowDays, windowSize, lastActiveOn, returnCount,
                 lastReturnSilenceDays, silenceDays },
  habits: [{ habitId, title, persistence: { …то же… } }],
  achievements: [{ code, title, description, hint, awardedAt, context }],
  awardedCount: number
}
```

- **Всё считается проекцией** из `habit_tasks`/`micro_win_logs`/`goal_entries`; своя таблица одна —
  `user_achievements` (факт выдачи, пересчитать нельзя). Ни одного числа, которое можно набить
  независимо от жизни: очков нет, уровней нет.
- **День засчитан = любое зафиксированное действие** (отметка задачи, микро-победа, запись в
  цель). Порога «≥70% задач дня» нет: он вернул бы «всё или ничего».
- `returnCount` — сколько раз человек возвращался после 7+ дней тишины. **Факт, не награда:**
  достижение `returned` выдаётся один раз за всё время, а число показывает правду дальше.
- `achievements` — **весь каталог**, включая невыданные (`awardedAt: null`) с подсказкой `hint`
  «как получить»: путь должно быть видно, иначе достижения превращаются в лотерею.
- `habits` — только свои привычки; примеры-витрины исключены ([ADR-0051](../../decisions/0051-starter-habits-inert-showcase.md)).
- **Запрос лениво догоняет отложенное:** выдаёт заслуженные достижения и дописывает вехи «держусь»
  (`goal_reached`, [ADR-0060](../../decisions/0060-anti-habit-calendar-goal-ladder.md)) по всем
  анти-привычкам, сообщая о **старшей** веха в центр уведомлений. Крона нет: доставка у нас всё
  равно происходит в момент, когда человек пришёл.

## 13. Ролловер
**Сейчас (2.4): ленивая материализация на чтение** — `ensureTasksForDay` создаёт задачи дня из активных Habit по RRULE при запросе `GET /accent/tasks?date=` (по `timezone`, §0). **Фоновый cron (`@nestjs/schedule`) не понадобился и в 2.9** (решение 04.08.2026): доставка любых напоминаний у нас происходит в момент захода человека — push-ов нет до нативки (фаза 8). Вернуться к фоновому проходу имеет смысл с 2.8, где `Recommender` сам захочет генерить серверные ноты. В recovery/паузе — мягкий ролловер (минимальные версии).

## 14. AI-эндпоинты (волна, заложить путь)
`POST /accent/ai/decompose-goal`, `POST /accent/ai/repack-after-relapse` — с границами безопасности (спек: не стыдить, не обещать лечение, объяснимость). Не в MVP.
