# impl-phase2-plan.md — план фазы 2 «Акцент» (resumable)

> Лимиты заходов ~5ч непредсказуемы → дробим. На новой сессии: открыть этот файл →
> «Текущая позиция» → продолжить с неё. Фаза 2 **начинается с ВЫЧИТКИ доки раздела**
> (memory `accent-sustainable-achievement-design`: «сперва идеальная дока»): проходим
> каждый файл/раздел, обсуждаем, при необходимости **переписываем / дополняем /
> выкидываем** идею. Реализация — только после того, как дока согласована.
>
> Дока-источник: `docs/sections/accent/{README,domain-model,gamification,api-contracts,ui-ux}.md`
> + ADR-0027 (ядро), ADR-0028 (timezone + домены). Фундамент (ЛК) — фаза 1, готова.

## Текущая позиция (по факту)
- **R0 (вычитка) ЗАВЕРШЁН:** README ✅ · domain-model ✅ · gamification ✅ ·
  api-contracts ✅ · ui-ux ✅. Все решения — в журнале; дорожная карта 2.0.0→2.12
  зафиксирована; карта таблиц БД и схемные развилки собраны.
- **R1 ЗАВЕРШЁН** (R1a финализация + R1b аудит). Аудит нашёл и закрыл 3 расхождения:
  +эндпоинты справочников `domains`/`attributes`; +`attributes?`/`parentGoalId?` в
  Goal POST; +`attributes?` в Habit POST. Дока «Акцента» консистентна.
  **R2 ЗАВЕРШЁН:** заведены **ADR-0047** (конвенция имён), **ADR-0048** (доменные
  уточнения: merge/иерархия C+/состояния/метод), **ADR-0049** (принципы: внешняя
  память + самокомандование); индекс ADR и шапка accent-README перелинкованы.
  **Код: ·1 ✅ (зонтик AccentModule), ·2 ✅ (таблица accent_settings, миграция 0003 на dev),
  ·3 ✅ (домен), ·4 ✅ (API settings/pause/resume под Guard, прогнан end-to-end).
  ·5 ✅, ·6 ✅. **КАРКАС 2.0.0 ЗАДЕПЛОЕН на прод (`75c0dff`, VERSION 2.0.0), smoke зелёный,
  broadcast-нота отправлена.** + сегодня пред-деплойные фиксы: мобильное меню (fullscreen
  blur+крестик), человекочитаемые даты (Intl), 404 «На главную» контекстная.
  **2.1 ГОТОВА ЛОКАЛЬНО (·1–·4) — НЕ продим, выкатим бандлем с 2.2:
  2.1·1 ✅ (таблицы), 2.1·2 ✅ (модуль+репо+ds), 2.1·3 ✅ (API domains/attributes под Guard),
  2.1·4 ✅ (идемпотентный сид: 10 сфер + 6 атрибутов, verified live 10/6 без дублей).
  В подфазе `2.2` (микро-победы, первый user-facing) сделаны `2.2·1` ✅ (БД, миграция 0005),
  `2.2·2` ✅ (бэк CRUD), `2.2·3` ✅ (API CRUD), `2.2·4` ✅ (complete=лог идемпотентно по дню) и
  `2.2·5` ✅ (стартовый набор), `2.2·6` ✅ (фронт), `2.2·7` ✅ (**задеплоено на прод как 2.2.0**,
  commit a30fda5, smoke зелёный: version 2.2.0, domains=10/attrs=6, broadcast создан).
  **🎉 ПОДФАЗА 2.2 ЗАВЕРШЕНА И НА ПРОДЕ.**
  **ПЕРЕНУМЕРАЦИЯ (Elmir 2026-06-17):** вставлена НОВАЯ подфаза `2.3`; старые 2.3–2.11 сдвинуты
  на 2.4–2.12, поздняя волна → 2.13+ (сквозной сдвиг в трекере/ADR-0049/памяти; section-доки
  api-contracts/domain-model/ui-ux/README НЕ трогали — там «2.N» это номера секций, синхроним
  точечно при касании). Следующее — **новая подфаза `2.3` (стартовый набор: отличимость
  стартовых от своих + adoption по «Сделал» + кнопка «Получить пак»)**; детальную нарезку — при
  старте. Затем `2.4` (привычки + лесенка + ролловер).
  **2.3 НАРЕЗАНА на шаги ·1–·6:** ·1 ✅ (БД is_starter + демонтаж авто-сева 2.2·5, миграция 0007);
  далее ·2 бэк (seedPack/clear/adoption) → ·3 API (starter-pack+isStarter) → ·4 фронт (badge/CTA/
  контекстная кнопка) → ·5 ui-ux мотив-описание «для тяжёлых дней» → ·6 деплой 2.3.0.
  ·1–·6 ✅ — **подфаза 2.3 ЗАВЕРШЕНА И НА ПРОДЕ как 2.3.0** (commit 1e5c3d1, миграция 0007,
  broadcast создан). **🎉 Стартовый пак по кнопке + adoption + мотив-блок «для тяжёлых дней» в бою.**
  Следующее — подфаза `2.4` (привычки + задачи + адаптивная лесенка) — **нарезана мелко на ·1–·20**
  (де-рискованно: каждый шаг = один слой/концерн; детальная секция ниже). Решения: расписание =
  RRULE (`rrule`), ролловер = ленивый сейчас (фоновый cron `@nestjs/schedule` отложен до серий
  ≈2.9, «не потерять»). `2.4·1` ✅ (habits, 0008), `2.4·2` ✅ (tasks, уник `(template_id,
  occurred_on)`, 0009), `2.4·3` ✅ (Habits порт+Drizzle-репо, каркас модуля). Следующее —
  `2.4·4` ✅ (Habits domain), `2.4·5` ✅ (Habits API), `2.4·6` ✅ (`rrule` + util `isHabitDueOn`,
  спот-чек точен), `2.4·7` ✅ (Task порт+Drizzle-репо в HabitsModule). **Зависимость `rrule` в
  package.json — на проде подтянется при build (·20).** `2.4·8` ✅ (ленивая материализация
  `ensureTasksForDay`), `2.4·9` ✅ (complete/uncomplete), `2.4·10` ✅ (перенос), `2.4·11` ✅ (разовые
  + overdue/due-today), `2.4·13` ✅ (API задач), `2.4·12` ✅ (**LadderEngine — рост/откат планки
  verified через API**). **Весь бэк 2.4 готов (·1–·13).** Фронт: `2.4·14` ✅ (типы+api). Следующее —
  `2.4·15` (фронт «Шаблоны» — список привычек + деактивация).**
- **Затем R2: ADR-0047** — конвенция имён раздела + сводка ключевых решений R0.
- **Потом — код:** старт подфазы `2.0.0` (каркас).
- Частичные правки уже применены по ходу (структурные следствия merge/нумерации):
  README §7, api-contracts §3/§10/§9, ui-ux §4 — приведены к факту.

## Легенда статуса
- ⬜ не дошли · 🔄 в процессе · 💬 обсудили (есть правки/вопросы — см. журнал) · ✅ обработано (вычитано + согласовано + синхронно)

---

## R0. Вычитка доки «Акцента» — по файлам и разделам

### README.md — обзор и scope (84 стр.) — ✅ вычитан 2026-06-15
- ✅ 1. Что это и для кого (north-star/антихрупкость — душа, не трогаем)
- ✅ 2. Привязка к фундаменту (фаза 1) — структура решена (#4)
- 💬 3. Состав раздела — состав ок; имена → терминология #1; порядок → метод #2
- ✅ 4. Сердце продукта — адаптивная лесенка (anti-burnout, оставляем)
- 💬 5. State-aware — стартуем с упрощённого резолвера (#3), 6-state позже
- ✅ 6. Принципы раздела (non-Skinner — ядро, оставляем)
- ✅ 7. Объём: MVP и волны — режем на самодостаточные под-этапы (#2)
- ✅ 8. Файлы раздела

### domain-model.md — сущности (129 стр.) — ✅ вычитан 2026-06-15
- ✅ 0. Карта связей (граф зависимостей → дорожная карта ниже)
- ✅ 1. Value objects / перечисления
- ✅ 2. Identity (→ код `Identity`, UI «личность»)
- ✅ 3. CheckIn и модель состояний (StateResolver — старт простой #3; CheckIn = единый дневной снимок, поглощает DailyMetric)
- ✅ 4. Goal + GoalEntry + Milestone (UI «Цель»)
- ✅ 5. Habit/TaskTemplate → Task + лесенка
- ✅ 6. PowerUp → код `MicroWin`, UI «микро-победа»
- ✅ 7. AntiHabit + Relapse (UI «держусь»)
- ✅ 8. BadGuy → код `Obstacle`, UI «препятствие»
- ✅ 9. Ally → код `Supporter`, UI «поддержка» (реестр; соц — 2.1)
- ✅ 10. Недельный слой и журналы (DailyMetric убираем — слита в CheckIn; остаются WeeklyGoal + DailyLesson)
- ✅ 11. Геймификация (сущности; правила — в gamification.md)
- ✅ 12. Порты (application-слой)
- 💬 13. Открытые развилки: R6/R10 ✅(ADR-0028); R8/R11 → gamification; R20-22 → позже

### gamification.md — правила (131 стр.) — ✅ вычитан 2026-06-15
- ✅ 1. Почему это работает (4 опоры)
- ✅ 2. Очки (PointEvent) — values → `points.config` (конфиг)
- ✅ 3. Калибровка очков за прогресс цели
- ✅ 4. Уровни (R11 ✅ ПОДТВ.: `sqrt(totalXP/100)`, статус без привилегий)
- ✅ 5. Серии (R8 ✅ ПОДТВ.: on-demand; min держит серию; freeze 1/нед; пауза)
- ✅ 6. Достижения (comeback/Феникс в приоритете)
- ✅ 7. `LadderEngine` — едет с Привычками (2.4); очки за ladder — 2.9
- ✅ 8. Анти-чит (self-honesty)
- ✅ 9. Событийная модель (GamificationListener)
- 💬 10. UI-проявления — конфетти/анимации обязаны уважать prefers-reduced-motion (→ ui-ux R21)

### api-contracts.md — REST (89 стр.) — ✅ вычитан 2026-06-15
- ✅ 0. Timezone (R6 ✅ ADR-0028) · ✅ Общее
- ✅ 1. Настройки раздела (→ 2.0.0) · ✅ 2. Identity (→ 2.8/2.0.0)
- ✅ 3. CheckIn / состояние — **trends переехали на `/checkins/trends`, `/metrics` убран** (merge) (→ 2.8)
- ✅ 4. Goals + Entries + Milestones (→ 2.5)
- ✅ 5. Habits + Tasks + лесенка (→ 2.4)
- 💬 6. PowerUps — route `/power-ups` → `/micro-wins` (финализация #1) (→ 2.2)
- ✅ 7. AntiHabits (→ 2.6)
- 💬 8. BadGuys — route `/bad-guys` → `/obstacles` (финализация #1) (→ 2.7)
- 💬 9. Allies — route `/allies` → `/supporters` (финализация #1); wave-ref → 2.13+ ✅ (→ 2.12)
- ✅ 10. Недельный слой и журналы — **`/metrics` удалён** (слит в CheckIn) (→ 2.10; lessons → 2.8)
- ✅ 11. Геймификация / статистика (→ 2.9)
- ✅ 12. Dashboard-агрегатор (1 запрос, серверная агрегация) (→ 2.11)
- ✅ 13. Ролловер (фон `@nestjs/schedule`, по timezone) (→ 2.4)
- ✅ 14. AI-эндпоинты (волна 2.13+, путь заложен)

### ui-ux.md — дизайн/экраны (77 стр.) — ✅ вычитан 2026-06-15
- ✅ 1. Тон «интерес, не страх» (душа — таблица ❌страх/✅интерес, не трогаем)
- ✅ 2. Дизайн-язык (тёмная+toggle, чистый SCSS, «один экран — одно решение»)
- ✅ 3. Доступность (a11y-first; `prefers-reduced-motion` ПОКРЫВАЕТ конфетти из gamification ✅)
- 💬 4. Карта экранов — `/metrics` убран ✅ (merge); routes `/power-ups`,`/bad-guys`,`/allies` → терминология (финализация)
- 💬 5. Дашборд — по «Самокомандованию» вынести «Сейчас: …» (рекомендации) в ГЕРОЙ, не №4 в стопке (детализация 2.11)
- ✅ 6. UX-механики (min-победа на карточке, лесенка-тост, таймер, частичное)
- ✅ 7. Компоненты (свои SCSS; AttributeRadar → волна, модель сразу)
- ✅ 8. Онбординг (волна 2.13+; первая победа за ~5 мин)
- ✅ 9. ПДн в UI (подсказки на свободных полях; без аналитики залипания)

---

## R1. Финализация доки + аудит консистентности (следующий этап)

> Цель: довести 5 файлов доки до идеала и убедиться, что они **согласованы между
> собой и с решениями R0** (Self-Consistency, `methodology.md` — проверка другим путём).

**Маппинг терминологии #1 (применяем во всех файлах):** Epic Win→`Goal`/«Цель» ·
PowerUp→`MicroWin`/«микро-победа» · BadGuy→`Obstacle`/«препятствие» ·
Ally→`Supporter`/«поддержка» · Secret Identity→`Identity`/«личность» ·
Quest→`Task`(oneOff). Routes: `/power-ups`→`/micro-wins`, `/bad-guys`→`/obstacles`,
`/allies`→`/supporters`. Компоненты: `PowerUpChip`→`MicroWinChip` и т.п.

### R1a — применить решения к ТЕКСТУ (по файлам; коммит на файл)
- [x] **R1a.1 · domain-model.md** ✅ — терминология (MicroWin/Obstacle/Supporter/
  Identity/Task) + **merge** (DailyMetric убрана из §0/§10/§12, тренды из CheckIn) +
  состояния #3 (StateResolver старт упрощённый) + `parentGoalId?`/конфиг-глубина §4/§13.
  grep: ноль старых имён (кроме исторических пометок про DailyMetric).
- [x] **R1a.2 · gamification.md** ✅ — `power_up`→`micro_win` (source/событие),
  PowerUp→MicroWin (текст/лимиты), достижение `first_power_up`→`first_micro_win`.
  Правила/формулы не тронуты. grep чист.
- [x] **R1a.3 · api-contracts.md** ✅ — routes `/micro-wins`/`/obstacles`/`/supporters`
  + заголовки §6/§8/§9; `linkedPowerUpId`→`linkedMicroWinId`; dashboard-поля
  `metricsQuick`→`checkinQuick`, `badGuysActive`→`obstaclesActive`; Quest→one-off. grep чист.
- [x] **R1a.4 · ui-ux.md** ✅ — экраны (`/micro-wins`/`/obstacles`/`/supporters`),
  компоненты (`PowerUpChip`→`MicroWinChip`, `MetricSlider`→`CheckinSlider`), BadGuy→
  Obstacle, «волну 2.1»→`2.13+`, тренды из CheckIn + пометка дашборду (самокомандование). grep чист.
- [x] **R1a.5 · README.md** ✅ — §3 состав-таблица к терминологии (Goal/MicroWin/
  Obstacle/Supporter/Identity), DailyMetric убрана, подцели в Goal, Ally→Supporter в волнах. grep чист.

### R1b — аудит консистентности (сквозной, после R1a; коммит на находки)
- [x] **R1b.1 · терминология** ✅ — grep по 5 файлам: старых имён/routes нет (только
  намеренные историч. пометки «бывш. DailyMetric слита» в domain-model/api).
- [x] **R1b.2 · покрытие** ✅ — нашёл сироту: справочники `domains`/`attributes` имели
  таблицы (2.1), но **не было эндпоинтов** → добавлены `GET /accent/domains` и
  `/accent/attributes` (api §1a). Остальное (сущность↔эндпоинт↔экран↔таблица) покрыто,
  ноль остаточных `/metrics`.
- [x] **R1b.3 · контракты** ✅ — нашёл расхождения: `POST /accent/goals` не имел
  `attributes?`/`parentGoalId?`, `POST /accent/habits` не имел `attributes?` →
  добавлены. enum-статусы (Goal `active|paused|completed|archived`, Task
  `pending|done|partial|skipped`, HabitKind, UserState) совпадают между файлами.
- [x] **R1b.4 · ссылки + нумерация + метки** ✅ — все ADR-ссылки валидны (вкл. 0002/0014),
  внутр.-ссылки в одной папке; нумерация чистая (нет 2.0.X кроме каркаса, нет «волна 2.1»);
  метки R6/R10 (✅ ADR-0028), R8/R11 (→ gamification) помечены одинаково везде.

## Дорожная карта реализации (ЗАФИКСИРОВАНА 2026-06-15, реш. Elmir)

> Выведена из графа зависимостей domain-model (метод #2: каждый под-этап
> самодостаточен — работает сам, не ждёт параллельных/будущих фич; последующие
> надстраиваются над предыдущими). Каждый под-этап при кодинге дробится на шаги
> (как B/S/A/R фазы 1) — детализируем при старте этапа. Порядок зафиксирован,
> отдельные пункты можно осознанно переставлять, если всплывёт зависимость.

| Под-этап | Что | Зависит от |
|---|---|---|
| **2.0.0** | Каркас раздела: бэк-модуль `accent` + настройки/пауза (`accent_paused_from`); фронт — пункт «Акцент» в верхнем меню + вложенная навигация + заглушка дашборда | фаза 1 |
| **2.1** | Справочники: сферы (`Domain`) + атрибуты (`Attribute`) | 2.0.0 |
| **2.2** | **Микро-победы** (`MicroWin` + лог) — простейший трекер, ядро философии | 2.0.0 |
| **2.3** | **Стартовый набор: отличимость + adoption** — флаг «стартовое» (badge), кнопка «Получить стартовый пак», «Сделал» на стартовой → становится своей (остальные остаются помеченными). UX-онбординг практикой: пустого экрана нет, но выбор явный | 2.2 |
| **2.4** | **Привычки + Задачи + лесенка + ролловер** (RRULE, материализация, adaptive ladder) — сердце | 2.0.0 (опц. 2.1) |
| **2.5** | **Цели + записи + вехи** (forecast); привязка Привычка→Цель — additive поверх | 2.0.0 (опц. 2.1/2.4) |
| **2.6** | AntiHabit «держусь» + рецидивы (timer-модель) | 2.0.0 |
| **2.7** | Препятствия (`Obstacle`) + контрмеры (опц. ссылка на `MicroWin`) | 2.0.0 (опц. 2.2) |
| **2.8** | CheckIn + журналы + **простой** `StateResolver` + `Recommender` | 2.2/2.4/2.5 (для рекомендаций) |
| **2.9** | **Геймификация** (PointEvent/Achievement/Streak) — additive-слой поверх трекеров | трекеры 2.2–2.8 |
| **2.10** | Недельный слой (`WeeklyGoal` + items) | 2.0.0 |
| **2.11** | **Полный дашборд-агрегатор** (заменяет заглушку 2.0.0) | всё выше |
| **2.12** | `Supporter` (реестр; соц-взаимодействие → поздняя волна 2.13+) | 2.0.0 |

**Поздние волны (миноры `2.13+`, тоже фаза 2):** Workout (тяжёлый модуль),
соц/Ally-взаимодействие (видеть прогресс с согласия, совместные челленджи),
AI-помощник (декомпозиция/перепаковка срывов с границами), полный онбординг,
экспорт данных, шаблоны/квесты/сезоны/ритуалы.

### Версионирование (SemVer, реш. Elmir 2026-06-15)
- **Фаза проекта = мажор** (фаза 1 = `1.x`, фаза 2 «Акцент» = `2.x`, фаза 3 = `3.x`…).
- **Самодостаточная подфаза (новая функциональность) = минор** (`2.1`, `2.2`, …).
- **Багфикс внутри подфазы = патч** (напр. `2.11.1`, `2.11.2`).
- **Каркас фазы** = мажор-релиз `2.0.0` (раздел появился). Файл `VERSION` (ADR-0044)
  бампается при выкатке каждой подфазы в прод.
- (Фаза 1 целиком вышла как `1.0.0` — фич-шаги F1…F7/D1 шли ДО первого релиза, без
  промежуточных бампов; со 2-й фазы прод живой → каждый кусок = реальный релиз.)

**Подтверждённые следствия порядка:** геймификация (2.9) — ПОСЛЕ трекеров
(трекеры полезны и без очков; очки — additive, anti-Skinner); первый трекер —
`MicroWin` (проще Привычек). Identity — встроится по месту (1:1 к account, мелочь).

## Таблицы БД по подфазам (черновик; детальная схема — при кодинге подфазы)
> ≈1:1 с сущностями domain-model. Каждая подфаза = одна аддитивная миграция (как
> S-шаги фазы 1). Конвенции из фазы 1: PK `uuidv7___unixmillis`, FK `ON DELETE`,
> `created/updated_at`, optimistic `version` где нужно, индексы. Поля — в `domain-model.md`.

| Подфаза | Новые таблицы |
|---|---|
| `2.0.0` | `accent_settings` (1:1 account: `paused_from?` + настройки раздела) |
| `2.1` | `accent_domains` (сферы), `accent_attributes` (RPG-атрибуты) — справочники |
| `2.2` | `micro_wins`, `micro_win_logs` |
| `2.3` | (без новых таблиц) колонка `micro_wins.is_starter` (флаг «стартовое») + adoption-логика |
| `2.4` | `habits` (+ лесенка), `tasks` |
| `2.5` | `goals`, `goal_entries`, `milestones` |
| `2.6` | `anti_habits`, `anti_habit_relapses` |
| `2.7` | `obstacles`, `counterplays` |
| `2.8` | `check_ins` (единый дневной снимок, поглотил DailyMetric), `daily_lessons`, `accent_identities` (или в `accent_settings`) |
| `2.9` | `point_events`, `achievements` (каталог), `user_achievements` |
| `2.10` | `weekly_goals`, `weekly_goal_items` |
| `2.11` | — (агрегатор, новых таблиц нет) |
| `2.12` | `supporters` |

Без таблиц (вычисляемое): `StateResolver`, `Recommender`, серии (on-demand R8 —
материализация `streak_state` отложена).

**Схемные развилки (решаем на подфазе):**
- `goals.parent_goal_id?` (self-FK) + инвариант глубины из env `ACCENT_GOAL_MAX_DEPTH`
  (дефолт 2); rollup % родителя из подцелей → `2.5`.
- Лесенка в `habits` — `jsonb`-объект vs плоские колонки → `2.4`.
- `attributes[]` (0..N) — массив-колонка (`text[]`/`jsonb`) vs join-таблица → `2.1`/`2.4`/`2.5`.
- Сферы/атрибуты — таблицы-справочники (не enum в БД) → `2.1`.
- Identity — отдельная `accent_identities` vs поля в `accent_settings` → `2.0.0`/`2.8`.

## Нарезка подфаз на шаги (как B/S/A/I/R/F фазы 1)

> Каждая подфаза — вертикальный слайс, дробится на шаги (коммит на шаг + live-проверка).
> **Шаблон шага:** БД (схема+миграция) → домен (порт/репо/domain-service) →
> use-cases+API (zod-DTO+controller под AuthGuard, синхрон `api-contracts`) → фронт
> (api-сервис+зеркала → экран/навигация) → live-смоук + деплой (бамп `VERSION`).
> Детальные шаги минора уточняем ПРИ ЕГО СТАРТЕ (как в фазе 1). Нумерация: `<минор>·<N>`.

> **Архитектура раздела (ADR-0050):** МУЛЬТИМОДУЛЬ — область = свой модуль (как ф.1):
> `modules/accent/<area>/<area>.module.ts` (AccentSettingsModule/AccentGoalsModule/…),
> у каждого свои слои; тонкий зонтик `AccentModule` импортит area-модули; ORM в
> `database/`. Правило слоёв: контроллер→use-case всегда; кросс-домен/кросс-фаза ВНИЗ
> (use-case→чужой domain-service, не →use-case); свой порт/ds — по необходимости.
> Доступ к ф.1: импорт `AccessControlModule` (guard + AccountDomainService) и др.
> Цикл-риск держим событийной геймификацией (вниз). 2.0.0·1 = зонтик, 2.0.0·3 = AccentSettingsModule.

### 2.0.0 — Каркас (детально) ← СЛЕДУЮЩЕЕ
- [x] **2.0.0·1 (бэк)** ✅ — модуль `accent` (`modules/accent/accent.module.ts`, пустой контейнер) подключён в AppModule. Verified live (dev): `AccentModule dependencies initialized`, boot чист, health/ready 200, tsc зелёный.
- [x] **2.0.0·2 (БД)** ✅ — `accent_settings` (PK=FK `account_id`; `paused_from?`; timestamps; FK cascade) + интерфейс ADR-0033 + Drizzle-схема + миграция `0003`. Накатана на dev (psql ✅). `overall_streak_threshold` отложен на 2.9 (вар. A). На прод миграция — при деплое 2.0.0 (после ·6).
- [x] **2.0.0·3 (бэк)** ✅ — `AccentSettingsModule` (`modules/accent/settings/`): порт `ACCENT_SETTINGS_REPOSITORY` + Drizzle-репо (`database/repositories/accent/`) + `AccentSettingsDomainService` (getOrCreate/pause/resume); интерфейс перенесён в `settings/interfaces/`; зонтик `AccentModule` импортит модуль. Verified live (dev): `AccentSettingsModule dependencies initialized`, DI ок, health 200, tsc зелёный. (AccessControlModule не нужен — guard в ·4.)
- [x] **2.0.0·4 (API)** ✅ — `GET /accent/settings` + `POST /accent/pause|resume` (под AuthGuard) + use-cases (get/pause/resume) + view `AccentSettingsView`. `PATCH /accent/settings` отложен (его поле `overallStreakThreshold` — в 2.9; DTO не нужен — нет тела). Verified live (dev, throwaway+token): GET→`{accentPausedFrom:null}` (ленивое создание) → pause 204 → GET с датой → resume 204 → GET null; строка в БД. api-contracts §1 — синхронизировать (PATCH/threshold пометить как 2.9).
- [x] **2.0.0·5 (фронт)** ✅ — пункт «Акцент» в верхнем меню `/app` (массив `nav` в shell) + lazy-роут `/app/accent` → `AccentComponent` (заглушка `features/accent/`). `ng build` зелёный. Браузер-проверка — на Elmir'е (dev angular :4200).
- [x] **2.0.0·6 (фронт)** ✅ — раздел = layout с вкладками (Дашборд/Цели/Привычки/Микро-победы, `accent.routes` loadChildren) + дашборд с рабочим пауза-тумблером (`AccentApiService` get/pause/resume) + сид-заглушки (`AccentPlaceholderComponent`). `ng build` зелёный. Браузер-проверка — на Elmir'е.
- [x] **ДЕПЛОЙ 2.0.0** ✅ (`75c0dff`) — VERSION→2.0.0, прод-миграция 0003 (`accent_settings`), prod-build+up. Smoke зелёный: version 2.0.0, health 200, release-2.0.0.md раздаётся, `/accent/settings`→401 (guard), таблица в БД. Сид создал broadcast-ноту «Нормисы 2.0». Конвенция релизов: note + broadcast (ADR — TODO позже, пока в практике).

> **Готовый план `2.0.0·3` (для resume — просто выполнить по ADR-0050, мультимодуль):**
> Создать файлы:
> 1. **Перенести** интерфейс `modules/accent/interfaces/accent-settings-full.interface.ts`
>    → `modules/accent/settings/interfaces/accent-settings-full.interface.ts` и поправить
>    импорт в `database/schemas/accent-settings.schema.ts` (путь `…/accent/settings/interfaces/…`).
> 2. `modules/accent/settings/adapters/accent-settings-repository.port.ts` — токен
>    `ACCENT_SETTINGS_REPOSITORY` + интерфейс `AccentSettingsRepositoryPort`:
>    `findByAccount(accountId): Promise<AccentSettingsFull|null>`,
>    `create(accountId): Promise<AccentSettingsFull>` (идемпотентно: `onConflictDoNothing` по PK + refetch),
>    `updatePausedFrom(accountId, value: Date|null): Promise<AccentSettingsFull>`.
> 3. `database/repositories/accent/accent-settings.repository.ts` — Drizzle-реализация
>    (инжект `DRIZZLE`; строка `accent_settings` 1:1 c `AccentSettingsFull` → прямой маппинг).
> 4. `modules/accent/settings/domain-services/accent-settings.domain-service.ts` —
>    `getOrCreate(accountId)` (findByAccount ?? create), `pause(accountId)` (updatePausedFrom=now),
>    `resume(accountId)` (updatePausedFrom=null). Зависит только от порта.
> 5. `modules/accent/settings/accent-settings.module.ts` — providers:
>    `{ provide: ACCENT_SETTINGS_REPOSITORY, useClass: AccentSettingsRepository }` +
>    `AccentSettingsDomainService`; `exports: [AccentSettingsDomainService]`. (AccessControlModule
>    НЕ нужен в ·3 — guard появится с контроллером в ·4.)
> 6. Зонтик `modules/accent/accent.module.ts` → `imports: [AccentSettingsModule]`.
> Проверка: `tsc` + dev boot (`AccentSettingsModule dependencies initialized`) + health 200.
> Коммит nest + трекер раздельно. На прод НЕ деплоим (до 2.0.0·6).

### 2.1 — Справочники сфер + атрибутов (детально) ← СЛЕДУЮЩЕЕ
> Бэкенд-онли (фронт-селекторы появятся с потребителями 2.4/2.5). Read-only для клиента,
> наполнение — сид. Область `modules/accent/reference/` (один area-модуль, ADR-0050).
- [x] **2.1·1 (БД)** ✅ — схемы `accent_domains` + `accent_attributes` (PK=`key` varchar(64),
  `title`/`position`/`is_active`/timestamps) + интерфейсы ADR-0033 + миграция `0004` (накатана
  на dev, обе таблицы есть). PK=slug (прецедент `Achievement.code`, нюанс к ADR-0016). tsc зелёный.
- [x] **2.1·2 (бэк)** ✅ — `AccentReferenceModule`: порт `ACCENT_REFERENCE_REPOSITORY` +
  Drizzle-репо (`listDomains`/`listAttributes` — активные, по `position`) + тонкий domain-service;
  зонтик импортит модуль. Verified live: deps initialized, health 200, tsc зелёный.
- [x] **2.1·3 (API)** ✅ — контроллер `GET /accent/domains`, `GET /accent/attributes` (AuthGuard,
  модуль импортит `AccessControlModule`) + тонкие use-cases + view `AccentRefItem` (key+title).
  Verified live: роуты смаппились, 401 без токена, health 200, tsc зелёный.
- [x] **2.1·4 (сид)** ✅ — `AccentReferenceSeedService` (OnApplicationBootstrap, best-effort):
  `ensureDomains`/`ensureAttributes` (bulk insert ON CONFLICT по `key`) + дефолты (10 сфер,
  6 атрибутов). Verified live (dev): 10/6 в БД, идемпотентно (рестарты без дублей), tsc зелёный.
  **2.1 готова локально (·1–·4). НЕ продим — выкат бандлем с 2.2.**
- **Деплой 2.1?** — НЕВИДИМ для юзера (нет UI-потребителя) → **РЕШЕНО:** бандлить в первый
  видимый релиз — `2.2.0` (см. шаг 2.2·7). Силент-деплоя/бампа на 2.1 не делаем.

### 2.2 — Микро-победы (детально) ← СЛЕДУЮЩЕЕ
> Первый **user-facing** функционал «Акцента» (бэк + фронт). Техформа «1 отжимание = победа»:
> быстрое действие 10 сек–5 мин, доступное даже в плохой день. Новая область
> `modules/accent/micro-wins/` (отдельный area-модуль, ADR-0050; зонтик импортит).
> **Деплоится бандлем с 2.1 → релиз `2.2.0`** (шаг 2.2·7). Очки за выполнение — НЕ здесь:
> геймификация (2.9) подпишется на событие `micro_win.completed`; пока complete только логирует.
- [x] **2.2·1 (БД)** ✅ — схемы `micro_wins` (`title`, `category` varchar-ключ 6 значений,
  `duration_seconds`, `energy_cost`, `effect?`, `disabled_for_states?` jsonb `UserState[]`,
  `is_active`, `account_id` FK cascade, timestamps; **CHECK** energy 1..3 + duration 0..300 как
  защита-в-глубину) + `micro_win_logs` (иммутабельный: id/account_id FK/micro_win_id FK/
  `occurred_on` date(YYYY-MM-DD)/created_at). **Дневной лимит = uniqueIndex `(micro_win_id,
  occurred_on)`.** Интерфейсы ADR-0033 (Full 1:1: `MicroWinFull`+`MicroWinCategory`+`UserState`,
  `MicroWinLogFull`). Миграция `0005` накатана на dev, обе таблицы/CHECK/FK/индекс на месте, tsc.
- [x] **2.2·2 (бэк CRUD)** ✅ — `MicroWinsModule`: порт `ACCENT_MICRO_WIN_REPOSITORY` (+ input-типы
  `MicroWinCreateData`/`MicroWinUpdateData`) → Drizzle-репо (`listByAccount`/`findOwned`/`create`/
  `update`/`remove`, всё скоупится по `account_id`) + domain-service (`list`/`getOwned`/`create`/
  `update`/`remove` с владением + инварианты title/duration 0..300/energy 1..3/category/states →
  `VALIDATION_ERROR`, дублируют DB-CHECK дружелюбной ошибкой; `MicroWinNotFoundError` 404). Const
  `MICRO_WIN_CATEGORIES`/`USER_STATES` вынесены в интерфейс (единый источник для DTO ·3). Зонтик
  импортит. AuthGuard/контроллер — ·3. Verified live: tsc зелёный, boot чистый (DI ok), health 200.
- [x] **2.2·3 (API CRUD)** ✅ — `MicroWinsController` под AuthGuard (импорт `AccessControlModule`):
  `GET`/`POST /accent/micro-wins`, `PATCH`/`DELETE /accent/micro-wins/:id` + 4 тонких use-case +
  closed-shape zod-DTO (`.strict`, enum category/states, int duration/energy в границах) + view
  `MicroWinView` (+`completedToday`, пока `false` до ·4) с маппером. **Verified live:** 4 роута
  смаппились, 401 без токена; полный CRUD-цикл на throwaway-аккаунте — создание 201, list,
  валидация 400 (energy>3, лишнее поле), PATCH 200, чужой id → 404, DELETE 204, повтор → 404.
  Dev-данные подчищены. tsc зелёный. Контракт совпал с `api-contracts.md §6` (дрейфа нет).
- [x] **2.2·4 (complete = лог)** ✅ — `POST /accent/micro-wins/:id/complete` Body `{ occurredOn? }`
  → domain `complete` (getOwned 404 + `logCompletion` ON CONFLICT `(micro_win_id, occurred_on)` →
  идемпотентно по дню). **TZ — из `request.account.timezone`** (поле фазы-1 в `accounts`, ADR-0028;
  НЕ из settings — там TZ нет; план поправлен, это данные Guard, не DI-вызов). `occurredOn` дефолт
  = сегодня в TZ (util `todayInTimezone`, нативный Intl `en-CA`). `completedToday` теперь реальный
  (list + complete считают `completedIdsOn(today)`). **Событие `micro_win.completed` — TODO-маркер
  под 2.9** (event-emitter не подключён, листенера нет → публикация была бы no-op; зависимость без
  спроса не тяну). **Verified live (throwaway):** complete 201 `completedToday:true`; повтор в тот
  же день идемпотентен (3 запроса → 1 лог); бэкдейт `2020-01-01` отдельным логом (в БД ровно 2
  строки); невалидная дата 400; чужой id 404. Dev-данные подчищены. tsc зелёный.
- [x] **2.2·5 (стартовый набор)** ✅ — при первом заходе на список micro-wins идемпотентно
  сеётся персональный набор из 7 низко-энергозатратных MicroWin (отжимание/вода/потянуться/
  балкон/вдохи/убрать вещь/записать чувство). **Идемпотентность — флаг `starter_micro_wins_
  seeded_at` в `accent_settings`** (миграция 0006), атомарный CAS-claim (защита от двойного
  сева в гонке). Кросс-домен вниз: `ListMicroWinsUseCase` зовёт settings-domain (claim) +
  micro-win-domain (`createStarterSet`/bulk). MicroWinsModule импортит AccentSettingsModule.
  **Verified live:** новый аккаунт → 7 в первом списке; повтор без дублей; флаг=t; **удалил всё
  → НЕ пересевается** (0 — держится на флаге, не на «список пуст»). Dev подчищен. tsc зелёный.
- [x] **2.2·6 (фронт)** ✅ — lazy-feature `/accent/micro-wins` (`MicroWinsComponent`): список
  карточек, complete одним тапом с дневным фидбэком (`✓ Сегодня` / кнопка «Сделал»), создание/
  редактирование через MatDialog (`MicroWinFormModalComponent`, reactive-форма, зеркальная
  валидация), удаление через confirm. EmptyState+CTA, Signals, OnPush, чистый SCSS. Типы +
  методы в `accent-api`/`accent.types`; роут заменил заглушку. **Verified:** tsc чистый, Angular
  AOT dev-сборка чистая, **prod-сборка со strictTemplates без ошибок** (чанк micro-wins-component);
  бэк-эндпоинты уже live-проверены (·3/·4/·5). Клик-через в UI — локально/на смоуке 2.2·7.
- [x] **2.2·7 (деплой 2.2.0 = бандл 2.1+2.2)** ✅ — `VERSION`→`2.2.0`, релиз-нота
  `release-2.2.0.md` + запись в `RELEASE_NOTES`. Задеплоено на прод (commit `a30fda5`):
  `git pull` → `prod-build` → `prod-up` (migrate-гейт накатил `0004`–`0006`). **Smoke зелёный:**
  `GET /version`=`{2.2.0, a30fda5}`, health 200; прод-БД — domains=10, attributes=6 (сид),
  таблица `micro_wins` есть, broadcast `release-2.2.0`=1 (уведомление всем создано).
  **🎉 Первый видимый функционал фазы 2 на проде. Подфаза 2.2 ЗАВЕРШЕНА (·1–·7).**

### 2.3 — Стартовый набор: отличимость + adoption (детально) ← СЛЕДУЮЩЕЕ
> Дизайн согласован (Elmir 2026-06-17): пак ТОЛЬКО по кнопке (первый заход — пусто+CTA);
> присвоение неявное (первое «Сделал»/«Изм.» снимает `is_starter`); контекстный слот
> «Очистить примеры» ↔ «Получить пак»; «Получить» только докидывает, своё не стирает.
> **Деплоится как `2.3.0`** (шаг 2.3·6). Очки за adoption/complete — это 2.9 (геймификация), не здесь.
- [x] **2.3·1 (БД + демонтаж авто-сева 2.2·5)** ✅ — добавлена `micro_wins.is_starter` (bool,
  default false) + поле `MicroWinFull`. **Авто-сев убран:** `ensureStarterSet` из
  `ListMicroWinsUseCase`, `claimMicroWinsStarter` (settings port/repo/domain), колонка
  `accent_settings.starter_micro_wins_seeded_at` (+ поле + schema), импорт `AccentSettingsModule`
  из `MicroWinsModule`. Миграция `0007` (add `is_starter`, drop старого флага) на dev. Verified:
  tsc зелёный, колонки на месте, boot чистый (DI ok, авто-сев убран без поломок), health 200.
- [x] **2.3·2 (бэк)** ✅ — domain+repo: `seedStarterPack(accountId)` (создаёт из `STARTER_MICRO_WINS`
  с `is_starter=true`, **только докидывает + дедуп по `title`**), `clearStarters` → repo
  `deleteStarters` (delete `is_starter=true` владельца, своё не трогает), **adoption** — `complete`
  (первое выполнение стартовой снимает `is_starter`) и `update` (любой edit присваивает). `create`/
  `createMany` + `MicroWinCreateData`/`MicroWinUpdateData` расширены флагом `is_starter`. (Очки за
  complete — TODO под 2.9.) Verified: tsc зелёный, boot чистый. API — ·3.
- [x] **2.3·3 (API)** ✅ — `POST /accent/micro-wins/starter-pack` (сев) + `DELETE …/starter-pack`
  (очистка примеров) + use-cases; оба возвращают свежий список (через `ListMicroWinsUseCase`).
  `isStarter` в `MicroWinView` (mapper). **Статичные роуты объявлены ДО `:id`** (иначе DELETE
  starter-pack ловится как `:id`). **Verified live (throwaway):** пусто (авто-сева нет) → POST
  pack → 7 `isStarter=true` → complete → присвоена (`isStarter=false`, completedToday) → PATCH →
  присвоена по edit → DELETE pack → остались только 2 присвоенные → POST снова → дедуп по title
  (дубль не создан), докинул отсутствующие, своё не стёрто. 401 без токена. Dev подчищен.
- [x] **2.3·4 (фронт)** ✅ — empty-state с CTA «Получить стартовый пак» (проекция в `<ng-content>`);
  badge «пример» на `isStarter` + хинт «„Сделал“ или „Изм.“ оставит победу себе» (когда есть
  примеры); контекстная кнопка в шапке (есть примеры → «Очистить примеры», нет → «Получить пак»,
  скрыта на пустом экране — там центральный CTA). Adoption в UI: complete патчит карточку
  (`isStarter`→false, badge уходит), edit перезагружает. `isStarter` в `MicroWinView` + api-методы
  `seedStarterPack`/`clearStarters`. Signals/computed `hasStarters`, OnPush, чистый SCSS.
  Verified: tsc + **prod-сборка strictTemplates без ошибок**.
- [x] **2.3·5 (фронт: мотивационное описание «для тяжёлых дней»)** ✅ — статичный callout `<aside>`
  под заголовком, **вместо** тонкой строки-лида: подложка `surface-2` + левая акцентная полоса +
  🌱, текст чуть мельче. Текст (согласован): «**Раздел для тяжёлых дней.** Нет сил на большое —
  сделай одно крошечное. Смысл не в том, чтобы успеть больше, а чтобы не упасть в ноль.» Тон
  «интерес, не страх»; операционализация memory `accent-core-why-anti-doomscroll` + слогана
  ADR-0049. Verified: tsc + prod-сборка strictTemplates без ошибок.
- [x] **2.3·6 (деплой 2.3.0)** ✅ — `VERSION`→`2.3.0`, `release-2.3.0.md` + `RELEASE_NOTES`.
  Задеплоено на прод (commit `1e5c3d1`): `git pull`→`prod-build`→`prod-up` (migrate-гейт накатил
  `0007`). **Smoke зелёный:** `GET /version`=`{2.3.0, 1e5c3d1}`, health 200; прод-БД —
  `micro_wins.is_starter` есть, старый флаг `starter_micro_wins_seeded_at` удалён, broadcast
  `release-2.3.0`=1 (уведомление всем). **🎉 Подфаза 2.3 ЗАВЕРШЕНА (·1–·6) и на проде.**

### 2.4 — Привычки + задачи + лесенка (детально) ← СЛЕДУЮЩЕЕ
> «Сердце продукта»: повторяющиеся привычки (Habit/шаблон) → задачи дня (Task) →
> **адаптивная лесенка** (min/current/goal target; рост после серии лёгких, откат при срыве)
> + **частичное выполнение** (≥minTarget = победа). Деплоится как `2.4.0` (·20).
> **➕ В 2.4.0 также входит улучшение микро-побед (Elmir 2026-06-18, бандл):** категории
> микро-побед расширены 6→**11** (хардкод-enum, не справочник — П3): +📵 Цифровое, 😴 Отдых,
> 🌱 Дух/смысл, 🌿 Природа, 🛡 Границы (отказ — ядро «тренажёра отказа»). Стартовый пак 7→**17**,
> у каждого `effect`. UI: подсказка выбранной категории в форме + **модалка-гид
> `CategoryGuideModalComponent`** (тех-стиль), открываемая и со страницы, и из формы создания/
> редактирования (вложенный диалог «что это?» — почитать, не теряя ввод). Бэк (enum+seed) + фронт
> готовы, verified (17 побед, 11/11 категорий, все с effect). Миграции нет (category=varchar без
> CHECK). Деплой — на ·20.
> **Решения (Elmir 2026-06-17):** расписание = **полный RRULE** (зависимость `rrule`);
> ролловер = **ленивый при чтении сейчас** (без cron). Очки/серии за выполнение — 2.9, не здесь.
> **⚠️ НЕ ПОТЕРЯТЬ (отложено):** фоновый полночный cron-ролловер (`@nestjs/schedule`,
> по timezone, мягкий в паузе/recovery) — добавить, когда появятся серии (≈2.9): тогда нужно
> материализовать задачи даже если юзер не заходил. Сейчас экран работает на ленивой матери­ализации.
**БД (2 шага):**
- [x] **2.4·1 (БД: habits)** ✅ — схема `habits` + интерфейсы ADR-0033 (`HabitFull`, `HabitLadder`,
  `HabitKind`, `LadderPolicy`). **Решено: `ladder` и `attributes[]` — jsonb** (по прецеденту
  `micro_wins.disabledForStates`); ladder несёт `easyStreak`/`missStreak` для LadderEngine §7.
  `goal_id` — без FK (до `goals` 2.5), `domain_key` — мягкий ключ, FK cascade на account.
  Миграция `0008` на dev (`\d habits` — 16 колонок, jsonb, defaults). tsc зелёный, health 200.
- [x] **2.4·2 (БД: tasks)** ✅ — схема `tasks` + `TaskFull`/`TaskStatus`/`TaskSkipReason` (kind
  переиспользует `HabitKind`). `template_id`→habits cascade (null=разовая), account cascade,
  goal_id/postponed_from_task_id — мягкие ссылки без FK. **Уник `(template_id, occurred_on)`** =
  1 инстанс/день (NULL-шаблоны разовых не конфликтуют). `occurred_on` date(YYYY-MM-DD),
  created_at only (статус меняется на месте). Миграция `0009` на dev (уник+FK ✅). tsc, health 200.

**Привычки — бэк + API (3 шага):**
- [x] **2.4·3 (Habits порт+репо)** ✅ — `HabitsModule` каркас (в зонтике); порт
  `ACCENT_HABIT_REPOSITORY` (+ input-типы `HabitCreateData`/`HabitUpdateData`) → Drizzle-репо
  (`listByAccount` активные по priority desc, `findOwned`, `create`, `update`; deactivate =
  update `isActive:false` на ·4), всё scope по `account_id`; ladder/attributes — jsonb прямой
  маппинг. Verified: tsc зелёный, boot чистый (DI ok), health 200.
- [x] **2.4·4 (Habits domain)** ✅ — `AccentHabitDomainService`: `list`/`getOwned`/`create`/`update`/
  `deactivate` (владение + `HabitNotFoundError` 404) + инварианты лесенки (policy/`minTarget≥1`/
  `current≥min`/`goal≥current`/`step>0` при adaptive → `VALIDATION_ERROR`) + базовая валидация RRULE
  (непустая + `FREQ=`; полный разбор — ·6). На create счётчики `easyStreak/missStreak=0`; при edit
  лесенки — **сохраняются** из существующей. Экспортится из модуля. Verified: tsc, boot, health 200.
- [x] **2.4·5 (Habits API)** ✅ — `HabitsController` под Guard (`GET`/`POST /accent/habits`,
  `GET`/`PATCH /accent/habits/:id`, `POST /accent/habits/:id/deactivate`) + 5 use-cases +
  closed-shape zod-DTO (ladder/enum/RRULE) + `HabitView` (скрывает easyStreak/missStreak).
  **Verified live (throwaway):** list пусто → create (adaptive+attrs) → 400 (current<min) →
  400 (плохой RRULE) → PATCH current=10 → GET → deactivate (isActive=false) → list пусто →
  чужой id 404. 401 без токена. Dev подчищен. tsc зелёный.

**Расписание (1 шаг):**
- [x] **2.4·6 (RRULE-util)** ✅ — зависимость `rrule@2.8.1`; чистая util `recurrence.util.ts`:
  `isValidRecurrence` + `isHabitDueOn(recurrence, dtstart, date)` (date-granular, «пространство
  дат» = UTC-полночь → без tz-сдвигов; dtstart-якорь для INTERVAL). Заменил эвристику в
  habit-domain на реальный валидатор. **dev-rebuild** (контейнер получил `rrule` — нюанс: фоновый
  запуск без `PROJECT_ROOT`/`.env` молча не собирал; пересобрал из корня). **Verified:** спот-чек
  6 кейсов (DAILY/BYDAY-будни/INTERVAL-чётность/до-старта) — все точны; API valid RRULE→201,
  `FREQ=NOPE`→400; boot чистый (TS-типы резолвятся), health 200.

**Задачи — бэк (5 шагов):**
- [x] **2.4·7 (Task порт+репо)** ✅ — порт `ACCENT_TASK_REPOSITORY` (+ `TaskCreateData`/`TaskUpdateData`)
  → Drizzle-репо (`listByAccountOn(date)`, `findOwned`, `create`, `createMany` с
  onConflictDoNothing по `(template_id, occurred_on)` для материализации, `update` статус/выполнение),
  scope по `account_id`. В `HabitsModule` (задачи — часть habits-области). Verified: tsc, boot, health 200.
- [x] **2.4·8 (ленивая материализация)** ✅ — `AccentTaskDomainService.ensureTasksForDay(accountId,
  date, tz)`: берёт активные привычки (`AccentHabitDomainService.list`), фильтрует по `isHabitDueOn`
  (якорь dtstart = локальная дата создания привычки в TZ), создаёт Task-снимки
  (`targetValue=currentTarget`, pending) через `createMany` (onConflictDoNothing → идемпотентно).
  Util `localYmd(date, tz)` обобщён (todayInTimezone теперь поверх него). Verified: tsc, boot
  (live — на ·12/·13).
- [x] **2.4·9 (выполнение: complete/uncomplete)** ✅ — `getOwned`/`complete`/`uncomplete` (+
  `TaskNotFoundError` 404). `complete(id, doneValue?)`: binary→done=1; quantitative/timed→`doneValue`
  (или весь target если не задан); статус `done` если ≥targetValue иначе `partial`; ставит
  `completedAt`, идемпотентно. `uncomplete`→pending (очищает doneValue/completedAt; revoke очков —
  TODO 2.9). «partial≥minTarget=победа» — стрик/лесенка (·11/2.9). Verified: tsc, boot (live — ·12).
- [x] **2.4·10 (перенос)** ✅ — `postpone(id)` → создаёт копию на завтра (как **one-off**,
  `templateId=null` → без конфликта уник `(template_id, occurred_on)`; `postponedFromTaskId`
  хранит происхождение), текущую → `skipped/postponed`. Гард: уже `skipped` → `VALIDATION_ERROR`.
  Хелпер `_nextDay` (UTC-полночь +1, «пространство дат»). Verified: tsc, boot (live — на ·12).
- [x] **2.4·11 (разовые задачи)** ✅ — domain `createOneOff` (templateId=null, валидация title/kind/
  occurredOn/target) + `listOverdue`/`listDueToday` (repo `listOpenOneOffWithDeadline` → JS-фильтр
  по `localYmd(deadline, tz)` vs сегодня) + `listForDay` (материализация+список). Verified в ·13.

**Лесенка (1 шаг):**
- [x] **2.4·12 (LadderEngine)** ✅ — `AccentLadderEngine` по алгоритму **gamification §7**:
  `performed≥current`→easyStreak++ (при ≥3 и <goalTarget → `current+=step`, ladder.raised);
  `≥minTarget`→easyStreak=0 (серия цела); иначе недобор→missStreak++ (при ≥2 → откат к minTarget,
  ladder.lowered). Счётчики `easyStreak/missStreak` в ladder (·1); `setLadder`/`findOwnedOrNull` в
  habit-domain (запись в обход merge). Врезан в `complete` **с гардом «один раз на выполнение»**
  (только переход из pending/skipped — повтор-тап не дёргает). Recovery-ветка → 2.8; очки за
  raised → TODO 2.9; `manual` не трогает. **Verified live (API):** 3 перехода→рост 5→6, 2 недобора→
  откат 6→5, повторный complete планку не двигает, счётчики сбрасываются. tsc, boot.

**API задач (1 шаг):**
- [x] **2.4·13 (API задачи)** ✅ (сделан вместе с ·11; ·12 LadderEngine — следующий, врежется в уже
  готовый `complete`) — `TasksController` под Guard: `GET /accent/tasks?date` (+ `overdue`/
  `due-today`), `POST /accent/tasks` (разовая), `POST /accent/tasks/:id/complete|uncomplete|postpone`
  + 7 use-cases + zod-DTO + `TaskView`. **Verified live (throwaway):** привычка → GET /tasks
  материализует (1 pending, target=5) → идемпотентно → done=2 (partial) → done=5 (done+completedAt)
  → uncomplete (pending) → overdue (1) → postpone (завтра, templateId=null) → today `[skipped,pending]`
  → чужой 404. 401 без токена. Dev подчищен.

**Фронт (6 шагов):**
- [x] **2.4·14 (фронт: типы+api)** ✅ — `accent.types`: `HabitView`/`HabitPayload`/`LadderView`/
  `HabitKind`/`LadderPolicy`/`HABIT_KIND_LABELS` + `TaskView`/`TaskStatus`/`TaskSkipReason`/
  `OneOffTaskPayload`. Методы `accent-api`: habits list/get/create/update/deactivate + tasks
  list(date?)/overdue/due-today/createOneOff/complete/uncomplete/postpone. Verified: tsc зелёный.
- [ ] **2.4·15 (фронт: «Шаблоны» — список)** — вкладка управления: список привычек (карточки:
  название/расписание/лесенка-сводка) + деактивация (confirm). EmptyState+CTA. **Получим:** обзор
  своих привычек. Verified: tsc + prod-сборка.
- [ ] **2.4·16 (фронт: модалка привычки)** — самая тяжёлая форма: create/edit (название/категория/
  атрибуты-мультиселект/сфера/kind/лесенка min·current·goal·step/policy/RRULE-пресеты daily·будни·
  каждые-N/minVersion). Зеркальная валидация. **Получим:** заведение/правка привычки. Verified: tsc + prod.
- [ ] **2.4·17 (фронт: «Сегодня» — список)** — вкладка дня: чеклист задач + % дня + 🔥-плейсхолдер,
  empty-state. Без интерактива карточки (он в ·18). **Получим:** видно задачи дня. Verified: tsc + prod.
- [ ] **2.4·18 (фронт: TaskCard-интерактив)** — выполнение в карточке: чекбокс (binary) / частичный
  ввод (quantitative·timed) / перенос; патч состояния. **Получим:** пользователь ведёт день. Verified: tsc + prod.
- [ ] **2.4·19 (фронт: фидбэк лесенки + полировка)** — тост «планка выросла 🎉 / сегодня мягче»,
  показ target/done, мелкая полировка/состояния. **Получим:** видимая адаптивность. Verified: tsc +
  prod-сборка strictTemplates.

**Деплой (1 шаг):**
- [ ] **2.4·20 (деплой 2.4.0)** — `VERSION`→`2.4.0`, `release-2.4.0.md` + `RELEASE_NOTES` (broadcast),
  `prod-build`/`up` (migrate-гейт), smoke. **Получим:** привычки + адаптивная лесенка в проде.

**Ретро (1 шаг, можно после деплоя):**
- [ ] **2.4·21 (ретро-обзор 0.0→2.4 в 3 шляпы)** — пройтись по всему пути (фаза 1 ЛК + 2.0.0→2.4)
  **как бизнес-аналитик + системный аналитик + эксперт по помощи людям**: БА — закрыта ли боль,
  ценность, что упустили по потребностям; СА — консистентность контрактов/моделей, edge-кейсы,
  нефункц. (идемпотентность/безопасность); помощь людям — UX/мотивация/забота, риск Skinner-box,
  барьеры, плохой день. Найденное → форки/задачи/патч. Не блокирует — обзорный (можно после деплоя).

### 2.5–2.12 — скелет (детальные шаги — при старте подфазы)
> **⚠️ ПРАВИЛО НАРЕЗКИ (Elmir 2026-06-18) для 2.5+/2.6+/3+:** при детализации каждой подфазы
> подключать **аналитическую линзу из 3 шляп** (как скилл/проход, при нужде — субагент):
> **бизнес-аналитик** (ценность/боль/для кого/приоритет) + **системный аналитик** (спека/модели/
> контракты/edge/нефункц.) + **эксперт по помощи людям** (психология, реальная польза, anti-burnout,
> тон «интерес-не-страх»). Не только тех-корректность. Это часть нарезки, а не опция.
- **2.2 микро-победы:** ✅ детализировано выше (2.2·1–·7).
- **2.3 стартовый набор (отличимость + adoption):** ✅ детализировано выше (2.3·1–·6), дизайн согласован.
- **2.4 привычки + задачи + лесенка:** ✅ детализировано выше (2.4·1–·21, вкл. ретро-обзор ·21), решения зафиксированы.
- **2.5 цели:** БД `goals`(+`parent_goal_id`)/`goal_entries`/`milestones` + env `ACCENT_GOAL_MAX_DEPTH` → домен (forecast/rollup/инвариант глубины)+API → фронт `/accent/goals` (+подцели).
- **2.6 держусь:** БД `anti_habits`/`anti_habit_relapses` → домен+API → фронт `/accent/anti-habits` (живой таймер).
- **2.7 препятствия:** БД `obstacles`/`counterplays` → домен+API → фронт `/accent/obstacles`.
- **2.8 состояние:** БД `check_ins`/`daily_lessons` → `StateResolver`(упрощённый)+`Recommender`+тренды+API → фронт `/accent/checkin` + «Сейчас» на дашборде.
- **2.9 геймификация:** БД `point_events`/`achievements`/`user_achievements` → `GamificationListener`(события)+серии on-demand+API → фронт XP/серии/достижения.
- **2.10 недельный слой:** БД `weekly_goals`/`weekly_goal_items` → домен+API → фронт `/accent/weekly`.
- **2.11 дашборд:** (без новых таблиц) агрегатор `GET /accent/dashboard` → фронт полный кокпит («Сейчас» — герой).
- **2.12 поддержка:** БД `supporters` → домен+API → фронт `/accent/supporters` (реестр).

## Открытые развилки (копим по ходу вычитки)
> Сюда выписываем всё, что в доке помечено как открытое/спорное, плюс что всплывёт.
> Крупная развилка → решаем и заводим **ADR** (следующий свободный — №0047; см.
> `docs/decisions/README.md`). Мелкие — фиксируем тут и правим доку.

- **Терминология (#1)** — применить маппинг (журнал ниже) сквозь `domain-model.md`,
  `ui-ux.md` и **routes `api-contracts.md`** (`/power-ups`→`/micro-wins`,
  `/bad-guys`→`/obstacles`, `/allies`→`/supporters`); при финализации — оформить как
  ADR-0047 (конвенция имён раздела).
- **Граф зависимостей → под-этапы (#2)** — ✅ СДЕЛАНО: «Дорожная карта» выше.
- **CheckIn ↔ DailyMetric — ✅ РЕШЕНО (Elmir 2026-06-15): СЛИТЬ.** Единый дневной
  снимок = `CheckIn` (надмножество полей), `DailyMetric` убираем, тренды 7/30/90
  строим из CheckIn. Правка `domain-model.md` (§0 карта / §10 / §12 ports
  MetricRepository) — в финализации файла. На дорожную карту не влияет.
- `domain-model.md §13`: R8 (серии on-demand/материализация) и R11 (формула XP) →
  решим в `gamification.md`; R20/21/22 (Identity/a11y/AI) → позже (волны).
- **Иерархия целей — ✅ РЕШЕНО (Elmir 2026-06-15): C+ «ограниченная глубина».**
  Подцель = та же `Goal` с `parent_goal_id?`. **Глубина — НЕ хардкод, а конфиг**
  `ACCENT_GOAL_MAX_DEPTH` (env, zod fail-fast, дефолт `2` = 1 уровень подцелей);
  менять → рестарт, без правок кода. Инвариант домена читает конфиг (`depth <
  MAX` иначе `GOAL_MAX_DEPTH_REACHED` 422). Фронт берёт лимит с бэка (settings/
  flags). Ежедневный поток (`Recommender` «Сейчас») работает на листьях, не на
  дереве → дерево не топит. **Rollup:** цель имеет ЛИБО свои записи, ЛИБО подцели;
  есть подцели → `%` = агрегат детей (формула — на 2.5). Применить на подфазе **2.5**
  (`goals.parent_goal_id` + инвариант + env-var).
- **Сессия 2026-06-17 (философия → продукт), решения Elmir:**
  - ✅ **Зафиксировано в ADR-0049 (доп.):** Принцип 3 «тренажёр отказа» (вычитание не
    добавление) + слоган «учит отказываться от лишнего ради важного» + фильтр на каждую
    фичу; Миссия «расширить бутылочное горло» + цель «ценить/приумножать/**передавать
    дальше**». Слоган вынесен в README §1.
  - 📋 **Кандидат-фича «вспомню ли через неделю?»** — линза смысла при оценке цели/задачи/
    действия → **2.13+**, спроектировать в доке при подходе к этапу.
  - 📋 **Петля = заработанные награды** → принцип **геймификации (2.9)**: награда ощущается
    заработанной, не дармовой (anti-Skinner на уровне механики). Двигать версии вперёд —
    норма, если важная фича готова раньше (2.12→2.13 и т.д.).
  - 💬 **Identity = «ценности как идентичность»** (само-передача культуры/рода) — обсудить
    отдельно; связать с сущностью `Identity` (R20, отложен).
  - 📋 **Свобода-как-отказ** в онбординге/копирайте/слое идентичности — ок, на этапе фронта.
    Уточнение 2026-06-17: свобода = варианты + власть фильтровать (не «только отказ»; ADR-0049 П3).
  - 🎯 **Дизайн survival-режима (вход: 2.8 StateResolver/Recommender + 2.11 дашборд):**
    активный **мягкий пинок (1 раз, не серия)** → ОДНА микро-победа движения + большая кнопка
    «сделал», с правом «не сейчас» (win-win день). Триггер survival: само-отметка «тяжёлый
    день» + вывод из CheckIn (низкая энергия/боль). **Отдельный справочник survival-целей НЕ
    нужен** — подбор = MicroWin с низким `energyCost` + не в `disabledForStates`; явный флаг
    `survivalFriendly` — аддитивно позже, если понадобится. Обучающийся подбор по истории
    «сделал» → **волна AI (R22, позже)**; сейчас rule-based. Пинок ≠ назойливое уведомление (П3).
    - 💬 **ОБСУДИТЬ (Claude объяснит Elmir):** что такое явный флаг `survivalFriendly` и чем он
      отличается от «выведенного» подбора (по `energyCost`+`disabledForStates`) — плюсы/минусы
      обоих, когда нужен явный флаг. Поднять при подходе к 2.8 или раньше по запросу.
  - 🎯 **Инвайт как заслуженное доверие (вход: инфра фазы 1 + Supporter 2.12):** «закрытая, но
    ценимая» система = уже текущая invite-only модель (бесплатно, но по приглашению). Соц-
    семантика «сильный дал инвайт» → связать с Supporter/пригласившим. **Осторожно:** не
    превращать инвайты в тщеславную метрику / искусственный дефицит (Skinner-box) — инвайт =
    передача доверия, не статусная игра (П3).

## Журнал вычитки (что обсудили / что изменили в доке)
> Хронологически. Формат: дата · решение/правка. Идеи — переосмысляем своими
> словами под наш scope (не копируем источники). Каждую правку доки — коммит
> (docs-слой), и обновляем «Текущую позицию» + статусы выше.

### 2026-06-15 · README вычитан, 4 решения
- **#2 (метод, ПРИНЯТО):** фаза 2 — инкрементально «от простого к сложному»; каждый
  под-этап **самодостаточен** (работает сам, не ждёт параллельных/будущих фич),
  последующие надстраиваются над предыдущими. Порядок под-этапов выведем из графа
  зависимостей доменной модели (при вычитке `domain-model.md`).
- **#3 (состояния, ПРИНЯТО):** `UserState` вычисляется (не хранится) → ранний этап =
  `CheckIn` (данные) + **простой `StateResolver`** (survival/stability/growth + paused);
  полная 6-state модель — поздний инкремент **без миграции** (умнее резолвер + правила).
- **#4 (структура, ПРИНЯТО):** НЕ микрофронты, без усложнения. Фронт — «Акцент» =
  обычный пункт верхнего меню (рядом с «Приглашения»); внутри — дочерние роуты +
  своя вложенная навигация (под-меню/вкладки), чтобы не сваливать всё на один экран.
  Обычная lazy-feature как в фазе 1. Бэк — набор под-модулей под `accent/`
  (goals/habits/gamification/state/…).
- **#1 (терминология, ПОДТВЕРЖДЕНО Elmir 2026-06-15):** русифицируем/нейтрализуем
  (выкинуть Epic/Secret/BadGuy). Код — нейтрально-англ., UI — рус.:
  Epic Win→`Goal`/«Цель»; PowerUp→`MicroWin`/«микро-победа»; AntiHabit→`AntiHabit`/
  «держусь»; BadGuy→`Obstacle`/«препятствие»; Ally→`Supporter`/«поддержка»;
  Secret Identity→`Identity`/«личность»; Quest→`Task`(oneOff)/«задача»; Comeback→
  UI «снова в строю»; Streak→`Streak`/«серия»; CheckIn→`CheckIn`/«отметка дня».
- **Не трогаем (душа раздела):** §6 принципы (non-Skinner), §4 лесенка (anti-burnout),
  §5 «срыв = данные».

### 2026-06-15 · domain-model вычитан; дорожная карта зафиксирована
- Построен граф зависимостей (§0) → **«Дорожная карта» 2.0.0→2.12 ЗАФИКСИРОВАНА**
  (метод #2: самодостаточные под-этапы).
- Форк «геймификация рано/поздно» — на усмотрение Opus → **оставлена поздно (2.9)**:
  трекеры полезны без очков, очки additive (anti-Skinner).
- Форк «первый трекер» — на усмотрение Opus → **`MicroWin` первый** (проще Привычек).
- Форк **CheckIn↔DailyMetric** — ✅ РЕШЕНО: **слить** (единый CheckIn, DailyMetric
  убрать, тренды из CheckIn). Применим в финализации `domain-model.md`.
- Терминология (#1) к тексту доки ещё НЕ применена (зафиксирована, применим при
  финализации файлов) — `domain-model.md` пока с исходными именами (Epic Win/BadGuy…).

### 2026-06-15 · gamification вычитан
- Геймификация принята как есть — сильная, в духе non-Skinner (очки ≠ валюта, уровни
  без привилегий, прозрачно, min держит серию, freeze = прощение, comeback в приоритете).
- **R11 ✅ подтверждён:** `level = floor(sqrt(totalXP/100))`, статус без привилегий.
- **R8 ✅ подтверждён:** серии on-demand (материализация `streak_state` отложена).
- **Заметка a11y:** конфетти/анимации достижений (§10) обязаны уважать
  `prefers-reduced-motion` → требование в `ui-ux.md` (R21).
- **Уточнение карты:** `LadderEngine` (подъём/откат планки) — механика Привычек (2.4),
  работает без очков; очки за `ladder.raised` — в геймификации (2.9).
- domain-model §11 (gamification-сущности) правок НЕ требует — совпадает с правилами.

### 2026-06-15 · api-contracts вычитан
- Контракт стройный (всё под `/api/v1/accent/...`, auth, ресурс владельца, cursor на
  историях, серверный `/accent/dashboard` за 1 запрос, ролловер фоном, AI в волне).
- **Применено сразу** (следствия решений): `/accent/checkins/trends` добавлен,
  `/accent/metrics` удалён (merge CheckIn↔DailyMetric); §9 wave-ref → 2.13+.
- **На финализацию:** routes под терминологию #1 (`/power-ups`→`/micro-wins`,
  `/bad-guys`→`/obstacles`, `/allies`→`/supporters`).
- Маппинг эндпоинт→подфаза проставлен в чеклисте (для нарезки при кодинге).

### 2026-06-15 · ui-ux вычитан — R0 ЗАВЕРШЁН
- Тон «интерес, не страх» (§1) и a11y-first (§3) — душа, не трогаем. **Конфетти-заметка
  из gamification ЗАКРЫТА:** §3 уже требует `prefers-reduced-motion` (покрывает анимации).
- **Применено сразу:** экран `/accent/metrics` убран, тренды → на экран чек-ина (merge).
- **На финализацию:** routes в карте экранов §4 под терминологию #1.
- **Уточнение для дашборда (2.11):** по принципу «Самокомандование» вынести
  директивную «Сейчас: …» (рекомендации) в ГЕРОЙ экрана, а не №4 в стопке.
- Компоненты/онбординг(волна)/ПДн-в-UI — ок. **Все 5 файлов R0 вычитаны.**

### 2026-06-15 · принцип «Внешняя память» + иерархия целей (конфиг-глубина)
- Добавлен принцип **«Внешняя память — разгрузка головы»** в README §6 (ядро, над
  Самокомандованием). Опора на бест-практис: GTD, Second Brain, cognitive offloading,
  эффект Зейгарник, just-in-time/progressive disclosure, single source of truth.
  Суть: голова не хранилище; БД = store, `Recommender`/дашборд = селектор среза.
- Иерархия целей — **C+**: подцель = `Goal` c `parent_goal_id?`; глубина — **конфиг**
  `ACCENT_GOAL_MAX_DEPTH` (env, дефолт 2), не хардкод. Rollup-формула — отложено на 2.4.

### 2026-06-15 · принцип «Самокомандование» + позиционирование (правка README §6)
- Добавлен **ядровый принцип «Самокомандование»** (Elmir): план задаёшь в ясном
  состоянии → система в моменте **директивно** ведёт по нему («Сейчас: …», 1 тап),
  масштаб под состояние, без вины за пропуск. Команда легитимна, т.к. своя
  (commitment device / автономия). **Влияет на:** `Recommender` (2.8) — отдаёт
  директивную «команду сейчас», и **дашборд** (2.11) — не пассивный список, а ясное
  «делай вот это» первично.
- Добавлено **позиционирование**: свободно/бесплатно/open-source без paywall (vs
  SuperBetter-бизнес и платные трекеры) — «помогаем взять контроль, не доим».
- Guardrail: директивный тон ≠ вина (тон «интерес, не страх» — наша защита).

---

## Принципы вычитки (держать в голове)
- **Сперва идеальная дока, потом код** (memory `accent-sustainable-achievement-design`).
- Дизайн на **anti-burnout / never-miss-twice**, НЕ Skinner-box (не дофаминовая ловушка).
- **Аналитическая линза = 3 шляпы** (Elmir 2026-06-18, опора на коммерч. опыт IT/МТС) — при нарезке
  КАЖДОЙ подфазы (2.5+/2.6+/3+) прогонять фичу через: **(1) бизнес-аналитик** — какую боль решает,
  для кого, ценность, приоритет, нужна ли вообще; **(2) системный аналитик** — требования→спека,
  модели данных/контракты, консистентность, edge-кейсы, нефункц. (идемпотентность/безопасность/
  производительность); **(3) эксперт по помощи людям** — психологическая обоснованность, реальная
  польза, anti-burnout, тон «интерес-не-страх». Не только тех-корректность. При нужде — субагент.
- **Регулярное ретро (как в скраме)** (Elmir 2026-06-18) — после каждой подфазы / крупной вехи
  обзор глазами того же аналитика: что могли не учесть для пользы человеку; находки → форки/
  задачи/патч. Первое формализованное — `2.4·21` (обзор всего пути 0.0→2.4).
- Дока отражает **намерение** (фазы 2 ещё нет в коде) — формулировки в будущем времени,
  статусы 📋/⬜; на настоящее переписываем по мере реализации (правило свежести, CLAUDE.md).
- Архитектура — та же, что фаза 1: 5-слойка, feature-first, Drizzle, id `uuidv7___unixmillis`,
  Signals + чистый SCSS, MatDialog. Кросс-домен только вниз.
- Реализацию (после вычитки) дробим под-волнами 2.0 → 2.1 (ADR-0027/todo) — детализируем здесь же.
