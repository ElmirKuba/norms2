# todo.md — план реализации Ascent

> Сквозной план разработки. Двигаться по фазам сверху вниз. Отмечать прогресс прямо здесь.

Связанные документы:
- [`Technical-assignment.md`](./Technical-assignment.md) — что делаем
- [`claude.md`](./claude.md) — как работаем
- [`docs/`](./docs/README.md) — детали реализации

Легенда: `[ ]` — не сделано, `[x]` — сделано, `[~]` — в работе, `[?]` — открытый вопрос.

---

## Фаза 0. Bootstrap

Цель: каркас репо, два независимых проекта, БД через Docker, фронт умеет дёрнуть бэк.

- [ ] Создать `./nest/` через `nest new --package-manager npm` (без monorepo, без strict false)
- [ ] Включить `strict: true` в `tsconfig.json` бэка
- [ ] Создать `./angular/` через `ng new ascent-web --standalone --routing --style=css --ssr=false`
- [ ] Подключить TailwindCSS в Angular (см. [`docs/frontend.md`](./docs/frontend.md))
- [ ] Создать `docker-compose.yml` в корне проекта с сервисами: `postgres`, `redis`. Файл описать в [`docs/deployment.md`](./docs/deployment.md)
- [ ] `.env.example` в `./nest/` со всеми переменными (см. [`docs/deployment.md`](./docs/deployment.md))
- [ ] Подключить TypeORM в Nest, настроить `DataSource` для миграций
- [ ] Сделать первую миграцию `001-init.ts` (пустую, чтобы убедиться, что инфраструктура работает)
- [ ] Endpoint `GET /api/health` → `{ status: 'ok', uptime, version }`
- [ ] В Angular — `core/api/health.service.ts`, дёргает `/api/health`, выводит на главной странице
- [ ] Настроить CORS в Nest для `http://localhost:4200`
- [ ] README в каждом проекте с командой запуска
- [ ] Написать [`docs/getting-started.md`](./docs/getting-started.md): шаги локального запуска
- [ ] Проверить: `docker-compose up -d`, `npm run start:dev` в `nest/`, `ng serve` в `angular/`, открыть http://localhost:4200, увидеть зелёный "OK" с бэка

**Готово к фазе 1, когда:** локальный setup воспроизводим по [`docs/getting-started.md`](./docs/getting-started.md) с нуля.

---

## Фаза 1. Auth + Users

Цель: регистрация, логин, защищённые эндпоинты.

См. также: [`docs/api-contracts.md`](./docs/api-contracts.md) §Auth, [`docs/domain-model.md`](./docs/domain-model.md) §User.

### Backend

- [ ] Модуль `users/` с сущностью `User` (id, email, passwordHash, displayName, locale, timezone, createdAt)
- [ ] Миграция `002-users.ts`
- [ ] Модуль `auth/`:
  - [ ] `POST /api/auth/register` — регистрация (валидация email, пароль ≥ 8 символов)
  - [ ] `POST /api/auth/login` — логин, возвращает `{ accessToken, refreshToken, user }`
  - [ ] `POST /api/auth/refresh` — ротация refresh-токена
  - [ ] `POST /api/auth/logout` — инвалидация refresh
  - [ ] `GET /api/auth/me` — профиль текущего пользователя
- [ ] `JwtAuthGuard` и декоратор `@CurrentUser()`
- [ ] Хранилище refresh-токенов: таблица `refresh_tokens` (id, userId, tokenHash, expiresAt, revokedAt)
- [ ] Тесты: register / login / refresh / logout / unauthorized

### Frontend

- [ ] `core/auth/auth.service.ts` с signal `currentUser`
- [ ] HTTP interceptor: подставить `Authorization: Bearer ...`, на 401 — попытаться refresh, на повторный 401 — редирект на login
- [ ] Экраны: `features/auth/login`, `features/auth/register`
- [ ] `AuthGuard` для защиты маршрутов
- [ ] Хранение токенов: `accessToken` в памяти, `refreshToken` в `httpOnly` cookie (если возможно) или в localStorage с пометкой о рисках в [`docs/frontend.md`](./docs/frontend.md)
- [ ] Settings → редактирование profile (displayName, locale, timezone)

### Docs

- [ ] Обновить [`docs/api-contracts.md`](./docs/api-contracts.md) — секция Auth
- [ ] Обновить [`docs/database.md`](./docs/database.md) — таблицы `users`, `refresh_tokens`

---

## Фаза 2. Goals (долгосрочные цели)

Цель: создать цель → инкрементить прогресс → видеть % и дедлайн.

### Backend

- [ ] Сущность `Goal`: id, userId, title, description, category (`spiritual|physical|mental`), targetValue, unit, deadline, status (`active|paused|completed|archived`), createdAt, completedAt, `pausedAt` (nullable), `pauseHistory` (jsonb `[{pausedAt, resumedAt}]`)
- [ ] Сущность `GoalEntry`: id, goalId, value (positive number), date (DATE), note, createdAt
- [ ] Миграция `003-goals.ts`
- [ ] CRUD endpoints для `Goal`: list / create / get / update / archive / restore
- [ ] `POST /api/goals/:id/pause` — пауза; фиксирует `pausedAt`, добавляет запись в `pauseHistory`
- [ ] `POST /api/goals/:id/resume` — возобновление; закрывает `resumedAt` в последней записи `pauseHistory`
- [ ] `POST /api/goals/:id/entries` — добавить запись прогресса (400 если цель на паузе)
- [ ] `GET /api/goals/:id/entries?from&to` — список записей
- [ ] Computed-поля при чтении: `currentValue`, `percentage`, `daysLeft`, `activeDays` (исключая время пауз), `pace`, `forecast`
- [ ] Тесты: создание, инкремент, переход в `completed`, пауза/возобновление, запись в паузе → 400

### Frontend

- [ ] `features/goals/goals-list` — список с фильтрами по категории и статусу
- [ ] `features/goals/goal-detail` — карточка с прогресс-баром, графиком, кнопкой "+1"
- [ ] `features/goals/goal-form` — создание/редактирование
- [ ] Сервис `core/api/goals.service.ts`

### Docs

- [ ] [`docs/api-contracts.md`](./docs/api-contracts.md) §Goals
- [ ] [`docs/domain-model.md`](./docs/domain-model.md) §Goal, §GoalEntry — детализация инвариантов
- [ ] [`docs/database.md`](./docs/database.md) — таблицы `goals`, `goal_entries`, индексы (userId, date)

---

## Фаза 3. Tasks (привычки и дневной планер)

Цель: повторяющиеся задачи с автоматическим ролловером.

### Backend

- [ ] Сущность `TaskTemplate`: id, userId, title, icon, recurrenceRule (RRULE-string), priority, isActive, `minVersion` (text, nullable — "минимум плохого дня"), createdAt
- [ ] Сущность `Task`: id, userId, templateId (nullable — для разовых), date (DATE), title, `category` (`personal|work|health|finance|other`, nullable — только для разовых), `deadline` (DATE, nullable — только для разовых), `priority` (`low|normal|high|urgent`), status (`pending|done|skipped`), completedAt, postponedFromTaskId (nullable)
- [ ] Миграция `004-tasks.ts`
- [ ] Сервис `RecurrenceService` с генерацией дат по RRULE
- [ ] Cron job (BullMQ scheduler): каждые 5 минут проверять пользователей, у которых наступила локальная полночь, и материализовать задачи на сегодня
- [ ] CRUD `TaskTemplate`
- [ ] `GET /api/tasks?date=YYYY-MM-DD` — задачи на день
- [ ] `GET /api/tasks/overdue` — разовые с `deadline < today()` и `status=pending`
- [ ] `GET /api/tasks/due-today` — разовые с `deadline = today()` и `status=pending`
- [ ] `POST /api/tasks/:id/complete` — отметить выполнение (идемпотентно)
- [ ] `POST /api/tasks/:id/uncomplete` — снять отметку
- [ ] `POST /api/tasks/:id/postpone` — перенести на завтра
- [ ] `POST /api/tasks` — создать разовую задачу с category, deadline, priority
- [ ] Тесты: ролловер, RRULE-edge cases (DST, переход месяца), overdue-логика

### Frontend

- [ ] `features/tasks/daily-checklist` — основной экран с задачами на сегодня
- [ ] `features/tasks/templates-list` — управление шаблонами привычек
- [ ] Компонент `<task-card>` с чекбоксом, swipe-actions (постпонить, удалить), badge категории
- [ ] Фильтр на `/tasks`: по категории (personal/work/health/finance/other), по статусу (все/просроченные/сегодня)
- [ ] Подсказка "минимум плохого дня": если `minVersion` заполнен + задача `pending` + время > 20:00 → показываем под названием задачи
- [ ] Анимация "галочка → growing checkmark", лёгкий haptic-like feedback (визуальный)
- [ ] Date picker для просмотра прошлых дней (read-only по умолчанию, редактирование с подтверждением)
- [ ] Виджеты дашборда: "Дедлайн сегодня N" (accent) и "Просрочено N" (danger красный) — тапабельны, ведут на `/tasks` с фильтром

### Docs

- [ ] [`docs/api-contracts.md`](./docs/api-contracts.md) §Tasks
- [ ] [`docs/domain-model.md`](./docs/domain-model.md) §TaskTemplate, §Task — описать различие шаблона и инстанса
- [ ] [`docs/backend.md`](./docs/backend.md) — отдельная секция про ролловер и RRULE

---

## Фаза 4. Weekly + Metrics

Цель: недельные цели, метрики самочувствия, урок дня.

### Backend

- [ ] Сущность `WeeklyGoal`: id, userId, weekStart (DATE, monday), title, completed (bool)
- [ ] Сущность `DailyMetrics`: id, userId, date (DATE, unique per user), sleepHours, energy (1..10), mood (1..10), note
- [ ] Сущность `DailyLesson`: id, userId, date, content (markdown), tags (text[])
- [ ] Миграция `005-weekly-metrics.ts`
- [ ] CRUD endpoints:
  - [ ] `GET/POST/DELETE /api/weekly-goals?week=YYYY-WW`
  - [ ] `GET/PUT /api/metrics?date=YYYY-MM-DD`
  - [ ] `GET/PUT /api/lessons?date=YYYY-MM-DD`
- [ ] `GET /api/weekly-stats?week=YYYY-WW` — сводка: лучший день, худший день, средний %, total tasks done
- [ ] Тесты: уникальность метрик на день, переход недели

### Frontend

- [ ] `features/weekly/weekly-planner` — экран недели: 5 целей слева, дни недели справа с задачами
- [ ] Bar chart прогресса по дням (ApexCharts)
- [ ] Donut общего % недели
- [ ] Лейблы лучший / худший день (зелёный / красный)
- [ ] `features/metrics/daily-metrics-form` — слайдеры
- [ ] `features/metrics/metrics-trends` — линейные графики за 7/30/90 дней
- [ ] `features/lessons/lesson-editor` — простой markdown editor

### Docs

- [ ] [`docs/api-contracts.md`](./docs/api-contracts.md) §Weekly, §Metrics, §Lessons
- [ ] [`docs/domain-model.md`](./docs/domain-model.md) — секции

---

## Фаза 5. Anti-habits

Цель: реестр того, что НЕ делать — таймер-модель (как Quitzilla), без ежедневных отметок.

### Backend

- [ ] Сущность `AntiHabit`: id, userId, title, description, isActive, `currentAttemptStartedAt` (bigint, unix ms), `attemptNumber`, `recordDays`, `recordAttemptStartedAt`
- [ ] Сущность `AntiHabitRelapse`: id, antiHabitId, relapseAt (bigint), attemptDurationMs, note
- [ ] Миграция `006-anti-habits.ts`
- [ ] CRUD `AntiHabit`
- [ ] `POST /api/anti-habits/:id/relapse` — фиксирует рецидив, сбрасывает таймер, обновляет рекорд
- [ ] При создании/рецидиве — планировать BullMQ delayed jobs на milestone-дни (3, 7, 14, 30...) для начисления очков
- [ ] При рецидиве — отменять pending milestone jobs
- [ ] Тесты: рецидив обновляет поля, рекорд обновляется только если текущая серия больше

### Frontend

- [ ] `features/anti-habits/list` — список карточек с живым счётчиком дней
- [ ] `features/anti-habits/detail` — экран с таймером `дни:часы:мин:сек`, кнопка "Рецидив" с подтверждением, история попыток
- [ ] Таймер реализован через `Date.now() - currentAttemptStartedAt` + `setInterval(1000)` — без запросов к бэку
- [ ] Circular ring — прогресс к текущей цели (например, 1 год)
- [ ] Поле для заметки при рецидиве

### Docs

- [ ] ~~[`docs/api-contracts.md`](./docs/api-contracts.md) §AntiHabits~~ ✅ обновлено
- [ ] ~~[`docs/domain-model.md`](./docs/domain-model.md) §AntiHabit~~ ✅ обновлено
- [ ] ~~[`docs/gamification.md`](./docs/gamification.md)~~ ✅ обновлено

---

## Фаза 6. Workouts

Цель: программы тренировок, фактические сессии.

### Backend

- [ ] Сущности `Workout`, `WorkoutExercise`, `WorkoutSession`, `WorkoutSessionEntry` — детали в [`docs/domain-model.md`](./docs/domain-model.md) §Workout
- [ ] Миграция `007-workouts.ts`
- [ ] CRUD `Workout` (с вложенными exercises)
- [ ] `POST /api/workouts/:id/sessions` — начать сессию (создаёт `WorkoutSession` со статусом `in_progress`)
- [ ] `PUT /api/workout-sessions/:id/entries/:exerciseId` — обновить факт по упражнению
- [ ] `POST /api/workout-sessions/:id/complete` — завершить сессию

### Frontend

- [ ] `features/workouts/list` — программы
- [ ] `features/workouts/editor` — редактор шаблона
- [ ] `features/workouts/active-session` — экран выполнения с таймером отдыха
- [ ] История сессий с прогрессом по весам

### Docs

- [ ] [`docs/api-contracts.md`](./docs/api-contracts.md) §Workouts
- [ ] [`docs/domain-model.md`](./docs/domain-model.md) §Workout

---

## Фаза 7. Gamification

Цель: очки, уровни, серии, достижения.

### Backend

- [ ] Сущность `PointEvent`: id, userId, source (`task|goal_entry|anti_habit_held|workout_session`), sourceId, points, createdAt
- [ ] Сущность `Achievement`: id, userId, code, awardedAt
- [ ] Миграция `008-gamification.ts`
- [ ] Сервис `PointsService` — слушает события доменов через `EventEmitter` (Nest), пишет `PointEvent`
- [ ] Сервис `AchievementsService` — после каждого `PointEvent` проверяет триггеры (см. [`docs/gamification.md`](./docs/gamification.md))
- [ ] `GET /api/me/stats` → `{ totalPoints, level, currentStreaks, longestStreaks, recentAchievements }`
- [ ] WebSocket gateway для realtime-уведомлений о новых достижениях

### Frontend

- [ ] Toast / модалка "Achievement unlocked"
- [ ] Виджет уровня и прогресс-бара до следующего
- [ ] Раздел "Достижения" в профиле

### Docs

- [ ] [`docs/gamification.md`](./docs/gamification.md) — полная таблица очков и триггеров
- [ ] [`docs/api-contracts.md`](./docs/api-contracts.md) §Stats

---

## Фаза 8. Dashboard

Цель: собрать главный экран из всего, что есть.

- [ ] `GET /api/dashboard` — агрегированный endpoint, возвращает всё нужное за один запрос
- [ ] `features/dashboard/dashboard-page` — компоновка виджетов
- [ ] Виджеты:
  - [ ] Сегодня (чеклист, % выполнения, текущая серия)
  - [ ] Неделя (donut + bar по дням, лучший/худший)
  - [ ] Активные цели (3–5 карточек)
  - [ ] Метрики дня (быстрый ввод)
  - [ ] Просроченные запланированные действия
- [ ] Адаптив: на мобильном — стек, на десктопе — grid 2×N
- [ ] Полирующие штрихи: skeleton loaders, empty states

См. [`docs/ui-ux.md`](./docs/ui-ux.md) §Dashboard.

---

## Фаза 9. Polish

- [ ] E2E-тесты Playwright: регистрация → создание цели → отметка задачи → достижение
- [ ] Unit coverage ≥ 70% в сервисах бэка
- [ ] Локализация i18n RU / EN (через `@ngx-translate` или встроенный Angular i18n — определить в [`docs/frontend.md`](./docs/frontend.md))
- [ ] Аудит a11y (keyboard, ARIA, контрасты)
- [ ] Бэкап-скрипт в `./scripts/backup.sh`, описан в [`docs/deployment.md`](./docs/deployment.md)
- [ ] Production Dockerfile-ы для `nest/` и `angular/`
- [ ] `docker-compose.prod.yml` с Caddy
- [ ] CI: GitHub Actions — lint, test, build images
- [ ] README в корне с быстрым стартом и ссылками

---

## Открытые вопросы

- [?] Хранить ли refresh-токены как plain JWT с jti или как opaque tokens с записью в БД (склоняемся ко второму, см. [`docs/api-contracts.md`](./docs/api-contracts.md) §Auth)
- [?] Считать ли серии материализованно (cron + поле `current_streak` в таблице) или каждый раз вычислять (window function). Зависит от размера данных одного пользователя за год; решить в фазе 7
- [?] Нужен ли push (web push) для напоминаний или достаточно email + in-app уведомлений. Можно отложить до post-MVP
- [?] Capacitor-обёртка для iOS — не блокирует MVP, но повлияет на хранение токенов (см. фазу 1) — учесть, чтобы не пришлось переделывать
