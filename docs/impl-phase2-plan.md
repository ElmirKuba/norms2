# impl-phase2-plan.md — план фазы 2 «Акцент» (resumable)

> Лимиты заходов ~5ч непредсказуемы → дробим. На новой сессии: открыть этот файл →
> «Текущая позиция» → продолжить с неё. Фаза 2 **начинается с ВЫЧИТКИ доки раздела**
> (memory `accent-sustainable-achievement-design`: «сперва идеальная дока»): проходим
> каждый файл/раздел, обсуждаем, при необходимости **переписываем / дополняем /
> выкидываем** идею. Реализация — только после того, как дока согласована.
>
> Дока-источник: `docs/sections/accent/{README,domain-model,gamification,api-contracts,ui-ux}.md`
> + ADR-0027 (ядро), ADR-0028 (timezone + домены). Фундамент (ЛК) — фаза 1, готова.
>
> Аудит безопасности фазы 2 — [`audit-phase2-security.md`](./audit-phase2-security.md).

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
  verified через API**). **Весь бэк 2.4 готов (·1–·13).** Фронт: `2.4·14` ✅ (типы+api), `2.4·15` ✅
  («Шаблоны»-список), `2.4·16a` ✅ (ядро модалки), `2.4·16b` ✅ (сфера+атрибуты в модалке).
  `2.4·17` ✅ («Сегодня»-список), `2.4·18` ✅ (TaskCard-интерактив: отметка/частичное/отмена/перенос),
  `2.4·19` ✅ (фидбэк лесенки: бэк `ladderEvent` live-verified + фронт авто-баннер «планка выросла/мягче»),
  `2.4·20·1` ✅ (DESIGN: инспекция 2.3 + ADR-0051 «инертная витрина», ветка Б),
  `2.4·20·2` ✅ (бэк: миграция 0010 `is_starter` + `STARTER_HABITS` + seed/clear/adopt + endpoints,
  материализация исключает примеры — live-verified 6 шагов), `2.4·20·3` ✅ (фронт: бейдж «пример» +
  CTA «Получить пак» + «Очистить»/«Добавить себе»). **Весь ·20 закрыт.** Затем UI-полировка
  (2.4.1…2.4.19: меню «⋯», иконки/тултипы, горизонтальный скролл+нудж, эмодзи-пикер, баг-фиксы).
  `2.4·21` ✅ деплой (в проде был 2.4.19; smoke 200/200; lock-фикс @emnapi по пути), `2.4·22` ✅ ретро
  0.0→2.4 ([retro-doc](./retro-phase2-0.0-2.4.md)). **Долг `2.4·23`/`2.4·24` ЗАКРЫТ и ЗАДЕПЛОЕН:**
  `2.4·23` ✅ (Accent→ADR-0035: version-колонка habits + CAS-лесенка + идемпотентный complete +
  postpone в транзакции), `2.4·24` ✅ (security-хардненинг: JWT≥32, security-заголовки, CORS-гард,
  verifyAnswers без тайминг-оракула). **В ПРОДЕ 2.4.20** (commit `c544c47` = HEAD, smoke `/version`=
  `{2.4.20, c544c47}`, 13 аккаунтов целы). Релиз-ноты/broadcast 2.4.20 НЕ слали (хардненинг невидим
  юзеру; решение о постфактум-рассылке — за Elmir). **Вся фаза 2.4 закрыта и в проде.**
  **2.5 «Цели» В РАБОТЕ:** `2.5·1` (DESIGN) ✅ — [ADR-0052](./decisions/0052-accent-goal-direction-and-computed-progress.md)
  (direction accumulate/reach/reduce + startValue; агрегаты вычисляемы → без version; forecast в едином
  пространстве доли `f`; rollup=среднее % детей; тон проективный). **`2.5·2`/`2.5·3`/`2.5·4` — ЗАКРЫТЫ ✅
  и LIVE-VERIFIED** (схема goals + миграция 0012 накатана на dev + `\d goals` ок: 19 колонок/оба FK/CHECK;
  порт+Drizzle-репо+GoalsModule, boot `GoalsModule dependencies initialized` + health 200; domain-service
  с инвариантами рода/глубины + config `ACCENT_GOAL_MAX_DEPTH` + 3 ошибки, DI резолвится). Dev-стек в начале
  сессии собирался ~18 мин (первый build), затем поднялся штатно (теперь Up; ранние `docker ps`-таймауты вводили
  в заблуждение — демон был занят сборкой). **`2.5·5` (lifecycle) и `2.5·6` (API целей) — ЗАКРЫТЫ ✅ LIVE:**
  HTTP-смоук всего бэка целей (throwaway+token на dev) **30/30 PASS** — 3 direction (вкл. reduce target=0),
  инварианты ·4 (400×2), глубина→422, lifecycle ·5 (pause/resume/archive/restore + повторные→400), 404/401,
  фильтры. Находка смоука: DB-CHECK `target<>0` рубил reduce target=0 → снят миграцией **0013**. Всё закоммичено
  (·5/·6/fix). dev-БД подчищена (throwaway удалён, accounts=18). **`2.5·7` — ЗАКРЫТ ✅** (схема `goal_entries`
  append-only + миграция 0014 + порт/Drizzle-репо с агрегатами sumValue/latestValue/earliestValue/count;
  boot/DI зелёный, таблица создана). **`2.5·8`+`2.5·9` — ЗАКРЫТЫ ✅ LIVE (смоук 22/22):** записи прогресса
  (addEntry + авто-completed атомарно) + вычисляемые currentValue/%/forecast/projectedDate в GoalProgressView
  + endpoints entries. Проверены 3 direction (accumulate/reach-как-reduce), forecast в f-пространстве,
  reduce target<start, пауза→409. Миграции до **0014**. Всё закоммичено, dev подчищена (accounts=18).
  **`2.5·10`+`2.5·11` (вехи) — ЗАКРЫТЫ ✅ LIVE (смоук 12/12):** схема `milestones` (миграция 0015) +
  domain/endpoints; `reached` вычисляем direction-aware; удаление только не достигнутой. Миграции до **0015**.
  **`2.5·12` (rollup) — ЗАКРЫТ ✅ LIVE (смоук 13/13):** прогресс родителя = среднее % детей, computed.
  **`2.5·13` (привычка→цель, кросс-домен ВНИЗ) — ЗАКРЫТ ✅ LIVE (смоук 9/9):** complete привычки докидывает
  прогресс в accumulate-цель (best-effort, без циклов DI, идемпотентно). **🎉 ВЕСЬ БЭК ЦЕЛЕЙ `2.5·1–·13`
  ГОТОВ И LIVE-VERIFIED** (миграции до **0015**, dev чистая accounts=18). **🎉 ВЕСЬ ФРОНТ ЦЕЛЕЙ `2.5·14–·21` ГОТОВ** (prod-сборки зелёные): типы+api, список (закрыл P2.3),
  модалка create/edit, детальный экран (запись прогресса+история+forecast), вехи, подцели, lifecycle-меню,
  привязка привычка↔цель, полировка (фильтр сферы+hscroll). **🎉 ПОДФАЗА 2.5 «ЦЕЛИ» ЗАВЕРШЕНА И В ПРОДЕ** (бэк ·1–·13 + фронт ·14–·21). Хвост ·28 закрыт
  (3 карты регресса зелёные, ~26 находок исправлены); ретро `·23` ✅ ([retro-phase2-2.5.md](./retro-phase2-2.5.md);
  топ-находка P1 — показать `fallbackVersion` на детали). **`2.5·FINISH` ✅ — прод 2.4.20 → 2.5.0** (commit 6cf019a,
  broadcast засеян); патч **2.5.1** ✅ (стабильный порядок drag-списков, тай-брейкер `id`) тоже в проде.
  **Текущая прод-версия — `2.5.6`** (`VERSION`=2.5.6; после 2.5.0/2.5.1 «Цели» вышли патчи: `2.5.4` FEAT-H1 таймер, `2.5.5` iPhone-звук, `2.5.6` app-number-field). **Подфаза `2.6` «держусь»:** Трек C — ЗАКРЫТ по коду + верифицирован (C1–C5), **не задеплоен**; Трек A (FEAT-H1) — в проде (2.5.4/2.5.5); Трек B (FEAT-H2 `clock`/полярность) — закодирован + API-verify, **не задеплоен** (ждёт click-verify). **Доработки «держусь» (стартер-пак / старт-дата+будущее / авто-цель / акцент рекорд+попытка / «Рецидив» / drag-reorder) → выйдут как `2.6.1`** — бэклог ниже (блок «2.6.1 — доработки «держусь»»). **СТАТУС 2026-07-24: весь код доработок готов и API-verified на dev** — D2 (события/planned/перенос) ✅, D3 (авто-цель календарная: nextGoal + материализация goal_reached + кольцо/морковка) ✅, D4/D5/D6 ✅, D7 (пасхалка «машина времени») ✅, D1 (стартер-пак инертный) ✅; feature-file + синхрон доки ✅. **Осталось за Elmir: браузер-verify всех механик + бандл-деплой** (VERSION один раз, prod-migrate 0028/0029/0030, бродкаст).
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
AI-помощник (**декомпозиция целей** / перепаковка срывов с границами), полный онбординг,
экспорт данных, **шаблоны/библиотека целей**, шаблоны/квесты/сезоны/ритуалы,
**повторяющиеся цели (циклы: «12 книг каждый год»)**.

**Решения по карте (Elmir 2026-06-23, по итогам сверки «как в лучших прилах»):**
- **Напоминания — через существующий центр уведомлений** (фаза 1: ноты об инвайтах/версиях), БЕЗ push-инфры/облаков (self-host). Серверные ноты «не отмечал прогресс N дней / срок вехи». «Умное когда/что» — **2.8** (`Recommender`/`StateResolver`) поверх готового центра нот.
- **Геймификация целей** (очки/серии/достижения за вехи/цели) — **2.9** (additive, anti-Skinner).
- 🔁 **ВЕРНУТЬСЯ к M#B3-5 (серии/стрик микро-побед) — здесь, в 2.9.** В ·28 осознанно решили НЕ делать
  классический стрик (Skinner-box, «не потеряй серию!»/обнуление — против never-miss-twice/анти-выгорания,
  ADR-0049, [[accent-sustainable-achievement-design]]). При проектировании геймификации 2.9 — спроектировать
  «постоянство» микро-побед ТОЛЬКО в anti-burnout-рамке: счётчик «дней с микро-победой» **без обнуления** и без
  давящих формулировок; никакого «серия прервётся!». Данные уже есть — агрегация по `micro_win_logs`. Контекст:
  M#B3-5 в разделе ·28 выше.
- **Графики/тренды:** самочувствие — **2.8**; графики прогресса целей и дашборда — **2.11** (либо мелкий `2.5.x`-патч для графика на детали цели).
- **Повторяющиеся цели + шаблоны целей** — фаза 2 (поздняя волна `2.13+`; шаблоны можно подтянуть раньше).
- **Соц/подотчётность** — `Supporter` **2.12** + глубокое взаимодействие `2.13+` (не превращать в тщеславную метрику, ADR-0049).
- **Ручная сортировка трекеров (drag-to-reorder)** — ⏫ **ПЕРЕНЕСЕНО в `2.5·27` (до деплоя, реш. Elmir
  2026-06-24 — «улучшает опыт пользователя»).** Сквозная мелко-фича для **всех трёх** трекеров
  (микро-победы / привычки / цели), идея Elmir (2026-06-24). Перетащил карточку (была 3-й сверху → утащил
  вниз) — порядок запомнился. **Требование: порядок хранится на сервере (колонка `position int` per-account
  в `micro_wins`/`habits`/`goals`) → cross-device** (зашёл с другого устройства — карточка на том же месте,
  не вернулась на 3-е; `localStorage` НЕЛЬЗЯ — он per-device). Нужны: колонка `position` + reorder-эндпоинт
  (обновление позиций) + drag-UI. **Развилка (ADR, слово Elmir): Angular CDK DragDrop (готово, но зависимость
  из экосистемы Material) vs свой drag на нативных Pointer Events (без либ, в духе «чистый SCSS»).** Делать
  единообразно разом отдельной подфазой; **кусок для целей** (drag-reorder ранга фокуса `focus_order`)
  органично подтягивается в **2.5·24 (Фокус)**. Связь: [[spa-no-reload-reactivity]] (без перезагрузки).
- **`2.5.x`-патчи целей:** ✅ **СДЕЛАНЫ** — правка/удаление записи прогресса (**патч 8**, live-смоук 7/7) +
  **график прогресса** (SVG-спарклайн на детали; accumulate — нарастающая сумма, reach/reduce — замеры) +
  **стартер-пак целей** (**патч 9**, инертная витрина ADR-0051, аналог микро-побед/привычек).
  Замыкает CRUD записей целей + закрывает «приятно-бы» график. Prod-сборка + tsc зелёные.
  - **Патч 9 (стартер-пак целей) — по факту:** колонка `goals.is_starter` (миграция `0017`);
    хардкод-константа `STARTER_GOALS` (18 примеров: 9 accumulate / 4 reach / 5 reduce — книги/спорт/
    отказ от курения/снижение веса и т.п., каждый с `whyItMatters`/`fallbackVersion`/атрибутами);
    `POST /accent/goals/starter-pack` (сеет с `isStarter=true`, объявлен ДО `:id`-роутов),
    `DELETE …/starter-pack` (чистит только непринятые примеры владельца), `POST /goals/:id/adopt`
    (снимает флаг). **Adoption неявное:** любой edit примера снимает `is_starter`; запись прогресса
    на примере → `400` («сначала Добавить себе»). Фронт: бейдж «пример», CTA «Получить пак /
    Очистить примеры», карточка «Добавить себе» на детали, дашборд исключает примеры. **Live-смоук
    7/7** (seed→18 isStarter, list, record→400, adopt→isStarter=false, record→201, clear→остаётся
    только принятая, accounts назад к 18).

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

### 2.0.0 — Каркас (детально) — ✅ ГОТОВО
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

### 2.1 — Справочники сфер + атрибутов (детально) — ✅ ГОТОВО
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

### 2.2 — Микро-победы (детально) — ✅ ГОТОВО
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

### 2.3 — Стартовый набор: отличимость + adoption (детально) — ✅ ГОТОВО
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

### 2.4 — Привычки + задачи + лесенка (детально) — ✅ ГОТОВО
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
- [x] **2.4·15 (фронт: «Шаблоны» — список)** ✅ — `HabitsComponent` (`/accent/habits`) с вкладками
  **Сегодня** (заглушка до ·17) / **Шаблоны**: список привычек (карточки: иконка+название /
  тип / человекочитаемое RRULE через `recurrenceLabel` / сводка лесенки `current→goal`) +
  деактивация через confirm + EmptyState. Роут заменил заглушку. Кнопки «Добавить»/«Изм.» —
  с модалкой на ·16. Verified: tsc + **prod-сборка strictTemplates** (чанк habits-component).
- [x] **2.4·16 (фронт: модалка привычки) ✅ — РАЗБИТ на ·16a/·16b** (Elmir: тяжёлая форма, де-риск).
  **Проверено целиком (live-матрица):** binary+daily / quantitative+adaptive+будни+сфера+атрибуты /
  timed+каждые-N+manual / custom-week — все 201; невалид current<min и goal<current — 400; edit
  round-trip (recurrence+лесенка+step+атрибуты+сфера) применился. tsc + prod-сборка чистые.
  Общая основа уже заложена в ·16a-коммите: api `listDomains`/`listAttributes` + тип `AccentRefItem`
  + util `recurrence-builder` (build/parse RRULE из пресетов).
  - [x] **·16a (ядро модалки)** ✅ — `HabitFormModalComponent`: название/иконка/описание/kind +
    **пикер расписания** (daily·будни·свои-дни·каждые-N → RRULE через `recurrence-builder` util,
    build+parse) + **лесенка** (min·current·goal·step·policy реактивно; для binary авто 1/1;
    кросс-валидация current≥min, goal≥current) + minVersion. Кнопки **«Добавить»/«Изм.»** в
    `HabitsComponent` (модалка MEDIUM, create/update → reload). Бэк create/update уже live-проверен
    (·5). Verified: tsc + **prod-сборка strictTemplates** чистые.
  - [x] **·16b (сфера + атрибуты)** ✅ — в модалку: select **сферы** (домены, опц. «не выбрана») +
    мультиселект **RPG-атрибутов** (чипы); каталоги грузятся через `listDomains`/`listAttributes`,
    префилл на edit. Payload += `domainKey`/`attributes`. **Verified:** tsc + prod-сборка; live —
    каталоги 10/6 отдаются, create с `domainKey='health'`+`attributes=['strength','discipline']` ok.
  - [x] **·16c (разжёвывание полей)** ✅ (Elmir: «всё разжевать для потерянного человека») —
    inline-подсказки под Тип/Повтор (что значит выбранный вариант) + хинт лесенки + интро атрибутов;
    **модалка-гид `HabitGuideModalComponent` «Как заполнять?»** (по аналогии с гидом категорий
    микро-побед): простым языком все варианты Тип/Повтор/Лесенка/Сфера/Атрибуты. Verified: tsc + prod.
- [x] **2.4·17 (фронт: «Сегодня» — список)** ✅ — вкладка дня в `HabitsComponent`: `selectTab('today')`
  грузит `listTasks` (материализация на бэке), список задач (название/мета тип·done/target/статус-
  бейдж), **% дня** (computed: done+partial от непропущенных) + 🔥-плейсхолдер «серия скоро» +
  EmptyState. Интерактив карточки (complete/частичное/перенос) — ·18. Verified: tsc + prod-сборка.
- [x] **2.4·18 (фронт: TaskCard-интерактив)** ✅ — в строке задачи: binary → кнопка «Сделал»;
  quantitative/timed → числовой ввод + «Отметить»; «Отменить» (done/partial); «→ Завтра» (pending,
  postpone→reload). `completeTask`/`uncompleteTask`/`postpone` патчат состояние (busyTaskId-спиннер).
  Лесенка двигается на бэке через `complete` (verified ·12). Verified: tsc + prod-сборка strictTemplates.
- [x] **2.4·19 (фидбэк лесенки) — ЗАКРЫТ** (разбит на бэк+фронт по правилу слоёв):
  - **·19a (бэк):** `complete` пробрасывает `ladderEvent` наружу — `{task, ladderEvent: raised|lowered|null}`
    (domain-service → use-case `CompleteTaskResult` → контроллер). Live-verified: easyStreak=2 +
    выполнение → ответ `{ladderEvent:"raised"}`, currentTarget 5→6. Контракт обновлён в accent/api-contracts.
  - **·19b (фронт):** `completeTask` читает конверт; при движении планки — авто-исчезающий (7с) баннер
    во вкладке «Сегодня» («🎉 Планка выросла…» / «🌙 Сегодня планка мягче…», с крестиком). Без новой
    глобальной тост-инфры (signal-баннер). Verified: tsc + prod-сборка strictTemplates. Визуальный
    клик в браузере — за Elmir (данные-путь проверен live на бэке).
  - **Получили:** видимая адаптивность (планка двигается → пользователь это видит).

**Стартовый пак привычек (DESIGN — продумать и нарезать, 1 шаг, БЕЗ кода):**
- [x] **2.4·20 (DESIGN: «стартовый пак привычек») — ЗАКРЫТ** ✅ (все ·20·1/·20·2/·20·3 ниже) — спроектировать аналог стартового пака
  микро-побед (2.3) для привычек: курируемый набор примеров-привычек с тегом **«пример»** (как
  `isStarter` у микро-побед), CTA/модалка «получить стартовый пак», adoption (взять пример → своя
  привычка), очистка непринятых примеров. Deliverable — **дизайн-нота + ADR + финальная нарезка
  ·20·1…·20·N** (код — в под-шагах). 9% лимитов: сейчас только продумать и нарезать. Линза 3 шляп.

  **Уточнено (Elmir 2026-06-18, проверено по коду):** `minVersion` («минимум на плохой день») — это
  **просто текст** на привычке, **НЕ ссылка на микро-победу** (0 связей в коде: `min_version text`,
  нигде не пересекается с micro-wins). Значит привычки с микро-победами **НЕ связаны** →
  **созависимые микро-победы, бандл и инлайн-создание микро-победы из формы — НЕ нужны** (идея
  возникла из прочтения этого инпута). Стартовый пак привычек = **чистое зеркало механизма 2.3**,
  без кросс-сущностей. Это убирает самую тяжёлую (транзакционно-кросс-модульную) часть.

  **Решено (·20·1, ADR-0051 + инспекция 2.3):**
  - **Механизм 2.3 (по факту):** колонка `is_starter` + хардкод-константа `STARTER_MICRO_WINS` +
    `POST/DELETE /micro-wins/starter-pack` (сеет с `isStarter=true`, дедуп по названию, только
    докидывает / удаляет непринятые) + adoption-флаг снимается при «Изм.» ИЛИ первом выполнении +
    `isStarter` в view → бейдж. **Авто-сева НЕТ** (только кнопка; комментарий в seed-файле про
    авто — drift, поправлен). **Модалки-превью НЕТ** — кнопка сеет примеры прямо в список.
  - **Модалка `.dlg` НЕ нужна** (зеркало 2.3 = просто кнопка/CTA, не окно).
  - **Развилка А/Б → выбрана Б** (инертная витрина), [ADR-0051](./decisions/0051-starter-habits-inert-showcase.md):
    пример-привычка видна в «Шаблонах» с бейджем, но **не материализует задачи / не двигает лесенку**
    до явного «Добавить себе» (или «Изм.»). Обратимо к А, если витрина «мёртвая».
  - **Курирование:** 4–6 шт., каждая anti-burnout (низкий `minTarget`, адаптивная лесенка, worded
    `minVersion` «пол плохого дня»). Финальный список — в ·20·2 (seed).

  **Нарезка (финал):**
  - [x] **·20·1** — инспекция 2.3 + ADR-0051 (развилка А/Б=Б) + дизайн (эта секция). ✅
  - [x] **·20·2 (бэк) — ЗАКРЫТ** — миграция 0010 (`is_starter` на `habits`); `STARTER_HABITS` (5 шт.:
    отжимания/чтение/дыхание/прогулка/сон, anti-burnout); `seedStarterPack` (дедуп по title) /
    `clearStarters` / `adopt` в domain; adoption при «Изм.» (update) и `POST :id/adopt`;
    `ensureTasksForDay` исключает `is_starter=true` (ветка Б); `POST/DELETE /accent/habits/starter-pack`;
    `isStarter` в `HabitFull`/`HabitView` + `createMany`/`deleteStarters` в репо. **Live-verified (6 шагов):**
    пак→5 примеров → `/tasks`=0 → дедуп → adopt→`isStarter=false` → `/tasks`=1 → очистка оставляет
    присвоенную. Контракт обновлён в accent/api-contracts.
  - [x] **·20·3 (фронт) — ЗАКРЫТ** — вкладка «Шаблоны»: пусто → CTA «Получить стартовый пак»
    (+ «Создать свою»); бейдж «пример» + хинт; кнопка «Добавить себе» (adopt); контекстная кнопка
    в шапке «Очистить примеры» ↔ «Получить пак». API seed/clear/adopt + `isStarter` в `HabitView`.
    Verified: tsc + prod-сборка strictTemplates.

  **→ Весь ·20 ЗАКРЫТ.** Стартовый пак привычек (инертная витрина, ADR-0051) готов фронт+бэк.

**Деплой (1 шаг — ПОСЛЕ стартового пака + UI-полировки):**
- [x] **2.4·21 (деплой) — ЗАКРЫТ (в проде 2.4.19)** — вместо 2.4.0 деплоили накопленную линию
  2.4.x (фичи 2.4 + UI-полировка 2.4.1…2.4.19). `release-2.4.19.md` + `RELEASE_NOTES` (broadcast),
  `git pull`→`prod-build`→`prod-up` (migrate-гейт прогнал 0008/0009/0010), smoke: site 200, api-health 200.
  **Заминка по пути:** `npm ci` в linux-сборке падал (EUSAGE: Missing @emnapi/core,runtime из lock —
  инкрементальная установка rrule не дорезолвила wasm-ветку) → чистая регенерация package-lock.
  **В проде:** привычки + адаптивная лесенка + фидбэк + стартовый пак + UI-полировка.

**Ретро (1 шаг, можно после деплоя):**
- [x] **2.4·22 (ретро-обзор 0.0→2.4 в 3 шляпы) — ЗАКРЫТ** → [docs/retro-phase2-0.0-2.4.md](./retro-phase2-0.0-2.4.md).
  Топ-находки (verified по коду): **P1** локаут без восстановления (recovery опционально/не предлагается →
  вчера потерян `@horstman56`); **P2** гонка на 2.4-записи (нет version-колонки/ADR-0035 на habits/tasks,
  лесенка read-modify-write), «Цели» — мёртвая вкладка (нет goals-модуля), серии/«never miss twice» не
  реализованы, RPG-атрибуты собираются но инертны, приватность инвайтов. Рекомендация: начать с #1
  (восстановление — быстрый, единственный с уже случившимся оттоком). Находки → задачи по выбору Elmir.

**Исправление рисков из ретро+аудита (реш. Elmir 2026-06-22: «исправим все»):**
- [x] **2.4·23 (Accent → ADR-0035, конкурентность) — ЗАКРЫТ** — (1) version-колонка на habits (миграция
  0011) + CAS-запись лесенки (`setLadderCas` + retry в движке); (2) идемпотентный `complete` (атомарный
  `updateIfOpen` по status IN pending/skipped → лесенка двигается раз); (3) `postpone` в `TransactionRunner`.
  **Live-verified:** raised→6 (version 0→1), повтор complete=null (6 без изменений), postpone=завтра+skipped.
- [x] **2.4·24 (security-хардненинг) — ЗАКРЫТ** — `JWT_ACCESS_SECRET .min(32)` (dev/прод-секреты ротированы
  на 48-симв.); удалён мёртвый `JWT_REFRESH_SECRET` (код+схема+`.env*.example`+доки); `CORS_ORIGIN≠"*"`;
  security-заголовки в `main.ts` (nosniff/X-Frame/Referrer — без deps); `verifyAnswers` без тайминг-оракула.
  Live: boot 200 с `.min(32)`, заголовки отдаются.
- **P1 «восстановление» — отложено post-alpha** (реш. Elmir: альфа, не бизнес-продукт).
  **Аудит 2026-06-22: P1 (эксплуатируемых атакующим) НЕ найдено** — auth/IDOR/валидация/секреты в порядке;
  остальные P3 (rate-limit per-instance и пр.) — приемлемы для self-host single-instance.

### 2.5 — Цели (детально, вариант B — полный) — ✅ ГОТОВО

> Полнофункционально (цели + прогресс + forecast + вехи + подцели + связь с привычками). Режем мелко
> и «не теряюще» между сеансами, как 2.4. **Линза 3 шляп** — на дизайн-шаге ·1.
>
> **🔧 Принцип конкурентности 2.5 (где version надо / не надо):** агрегаты (`currentValue`/`%`/`pace`/
> `forecast`/rollup) **ВЫЧИСЛЯЕМ из `goal_entries`/детей на чтение, НЕ храним счётчиком** → гонки нет,
> `version`-колонка **НЕ нужна** (в отличие от лесенки 2.4, где хранили счётчики). `goal_entries` —
> **append-only** (INSERT). Единственное «modify» — авто-`completed` (`completedAt`): **атомарный
> conditional-update** (`set completedAt where completedAt is null`), идемпотентно, без version. `PATCH`
> полей цели — last-write-wins (низкие ставки, version не нужен). Каждый шаг помечен 🔧, где это важно.

**Дизайн (1 шаг):**
- [x] **2.5·1 (DESIGN) — ЗАКРЫТ** ✅ — 3 шляпы + **[ADR-0052](./decisions/0052-accent-goal-direction-and-computed-progress.md)**.
  Решено: **`direction` ∈ accumulate/reach/reduce** (хардкод-enum) + **`startValue?`** (база reach/reduce,
  иммутабельна, null→первая запись); все агрегаты (`currentValue/%/pace/forecast/rollup`) **вычисляемы на
  чтение** из `goal_entries`/детей → **без хранимого счётчика/`version`** (единственный modify — авто-
  `completed` conditional-update); **forecast в едином пространстве доли `f`** (observedRate vs requiredRate,
  едино для всех direction) + `projectedCompletionDate`; **rollup = среднее % прямых детей**; тон forecast
  **проективный, не обвиняющий** («дойдёшь к ~ДАТЕ», не «отстаёшь»). Синхронизированы: domain-model §4/§13,
  api-contracts §4, индекс ADR. Нарезка ·2–·23 подтверждена (уточнения direction/startValue в ·2/·4/·9/·12).

**Бэк — ядро цели (5 шагов):**
- [x] **2.5·2 (бэк) — ЗАКРЫТ ✅** — схема `goals` (+`parent_goal_id` self-FK cascade, +`direction`,
  +`start_value`; `doublePrecision`; **без `version`**) + миграция **`0012_illegal_blur.sql`** + интерфейс
  `GoalFull` (`GOAL_DIRECTIONS`/`GOAL_STATUSES`/`GoalPausePeriod`). **Live-verified:** 0012 накатана на dev,
  `\d goals` — 19 колонок, оба FK (account+self cascade). _(CHECK `target<>0` был добавлен и затем **снят
  миграцией 0013** — рубил легитимные reduce-цели с `target=0`; см. ниже находку смоука ·6.)_
- [x] **2.5·3 (бэк) — ЗАКРЫТ ✅** — порт `ACCENT_GOAL_REPOSITORY` (`GoalCreateData`/`GoalUpdateData`/
  `GoalListFilters`) → Drizzle-репо (`listByAccount(status?,domain?)`/`listChildren`/`findOwned`/`create`/
  `update`; last-write-wins, без CAS) + `GoalsModule` в зонтике. **Live-verified:** `GoalsModule dependencies
  initialized`, `Nest application successfully started`, health 200.
- [x] **2.5·4 (бэк) — ЗАКРЫТ ✅ (boot/DI)** — `AccentGoalDomainService` (provider+export в `GoalsModule`):
  normalize title/unit + инварианты рода (accumulate `target>0`; reach/reduce `target≠start`) + глубина
  дерева из `ACCENT_GOAL_MAX_DEPTH` (env, дефолт 2; обход цепочки родителей) → `GOAL_MAX_DEPTH_REACHED` 422;
  `GoalNotFound` 404; `GoalPaused` 409 (для ·5/·8). **Live:** boot/DI + позже **HTTP-прогон инвариантов в
  смоуке ·6 (PASS):** accumulate target=0 → 400, reach target=start → 400, глубина → 422.
- [x] **2.5·5 (бэк) — ЗАКРЫТ ✅** — lifecycle: `pause` (active→paused, +paused_at), `resume` (paused→active,
  закрытый период `{pausedAt,resumedAt}` в `pause_history` через jsonb-конкатенацию на стороне БД, paused_at=null),
  `archive` (active|paused|completed→archived), `restore` (archived→active). **Атомарные** conditional-update
  `WHERE status=ожидаемый`; null → 404 либо `VALIDATION_ERROR` (неверное состояние) через `_failTransition`.
  Без version. **HTTP-смоук ·6 (PASS):** pause→paused(+pausedAt), pause-again→400, resume→active(pausedAt null),
  archive→archived, archive-again→400, restore→active.
- [x] **2.5·6 (бэк) — ЗАКРЫТ ✅ LIVE (HTTP-смоук 30/30 PASS)** — `GoalView`+mapper (даты→ISO; вычисляемый
  прогресс — ·9), zod-DTO create/update (closed-shape; direction/startValue иммутабельны в update), 8 тонких
  use-cases, `GoalsController` под AuthGuard: `GET/POST /accent/goals`, `GET/PATCH /:id`, `POST /:id/{archive,
  restore,pause,resume}`, фильтр `?status&domain`. **Смоук (throwaway+token, dev):** 3 direction (accumulate/
  reach/**reduce target=0**), инварианты ·4 (400×2), глубина (422), lifecycle ·5, 404/401, фильтры — все PASS.
  **Находка смоука → fix:** reduce-цель `target=0` («бросить курить») рубил DB-CHECK `target<>0` (500) → **снят
  миграцией `0013`** (инварианты значения и так в домене). Контракт api-contracts §4 уже описывал эти endpoints.

**Бэк — прогресс + вычисляемое (3 шага):**
- [x] **2.5·7 (бэк) — ЗАКРЫТ ✅ (boot/DI + миграция)** — схема `goal_entries` (append-only: `value`
  doublePrecision, `occurred_on` date, иммутабельна — только `created_at`; index `(goal_id,occurred_on)`;
  FK→goals cascade; **без DB-CHECK** — семантика `value` в домене ·8) + `GoalEntryFull` + миграция
  **`0014_cloudy_firelord.sql`** (накатана, таблица есть). Порт `ACCENT_GOAL_ENTRY_REPOSITORY` (отдельный,
  как tasks при habits): `add` (append-only INSERT), `listByGoal` (cursor по `id` desc), `sumValue` (Σ для
  accumulate), `latestValue`/`earliestValue` (reach/reduce + база при null startValue), `count`. Drizzle-репо
  — агрегаты на стороне БД. Provider в `GoalsModule`. 🔧 `currentValue` ВЫЧИСЛЯЕМ → без гонки. **HTTP-прогон
  агрегатов — на ·8/·9** (когда появятся addEntry+endpoints).
- [x] **2.5·8 (бэк) — ЗАКРЫТ ✅ LIVE** — entries domain: `addEntry` (append; `paused`→`GOAL_PAUSED` 409,
  `archived`→400, accumulate `value≠0`; дата по умолчанию — сегодня в TZ) + авто-`completed` (атомарный
  `markCompleted` на goal-репо: `WHERE completed_at IS NULL`, идемпотентно, без version) + `listEntries`
  (cursor по `id`). Событие `goal.completed` — TODO под 2.9 (эмит отложен). 🔧 conditional-update один раз.
- [x] **2.5·9 (бэк) — ЗАКРЫТ ✅ LIVE (смоук 22/22)** — чистый `goal-progress.util` (доля `f` direction-aware;
  `forecast` в `f`-пространстве observedRate vs requiredRate + `projectedCompletionDate`; `activeDays` минус
  паузы из `pauseHistory`) + `GoalProgressView`/`GoalEntryView` + endpoints `POST`/`GET /accent/goals/:id/entries`
  (cursor). `list`/`get` отдают **вычисляемый прогресс** (tz из аккаунта). **Смоук (throwaway+token):**
  accumulate 40→70%→авто-complete 100% (forecast=ahead+projectedDate), **reduce target<start** (f=0.5→
  авто-complete), accumulate value=0→400, пауза→409, чужой→404, история cursor — **все PASS**. dev-БД подчищена
  (accounts=18, goal_entries каскад=0 сирот).

**Бэк — вехи + подцели + связь (3 шага):**
- [x] **2.5·10 (бэк) — ЗАКРЫТ ✅ (boot/DI + миграция)** — схема `milestones` (`threshold_value`
  doublePrecision; **без `reached_at`** — достигнутость вычисляется; FK→goals cascade; index goal_id) +
  `MilestoneFull` + миграция **`0015`** (накатана, таблица есть). Порт `ACCENT_MILESTONE_REPOSITORY`
  (add/listByGoal/findInGoal/remove) + Drizzle-репо. Provider в `GoalsModule`.
- [x] **2.5·11 (бэк) — ЗАКРЫТ ✅ LIVE (смоук 12/12)** — `isMilestoneReached` (direction-aware: accumulate/
  reach `≥`, reduce `≤`) в `goal-progress.util`; domain `addMilestone` (порог accumulate `0<threshold≤target`)/
  `listMilestones` (reached из текущего прогресса)/`removeMilestone` (только не достигнутую → иначе 400) +
  `MilestoneView` + DTO + 3 use-cases + endpoints `POST`/`GET`/`DELETE /accent/goals/:id/milestones` (DELETE 204).
  **Смоук:** пороги 3/7/10, reached по мере записей (+4→@3, +8→@7), порог>цели→400, del не достигнутой 204 /
  достигнутой 400, чужое→404 — **все PASS**. dev-БД подчищена (accounts=18, 0 сирот).
- [x] **2.5·12 (бэк) — ЗАКРЫТ ✅ LIVE (смоук 13/13)** — подцели **rollup**: `describe()` при наличии
  активных детей считает прогресс родителя = **среднее % прямых детей** (рекурсивно, глубина ограничена;
  `currentValue`/`pace`=null — единицы разнородны; forecast из доли `f=avg%/100`+дедлайна родителя).
  `GoalProgress` += `rollup`/`subgoalsTotal`/`subgoalsCompleted`. Вынесен общий `forecastBlock`+`activeDaysOf`
  (лист и rollup — один прогноз). `parent_goal_id`+глубина уже были (·2/·4). **Смоук:** лист rollup=false; 2 детей
  → rollup=true/subs=2/cur=null; A50%→родитель 25%; B100%→75%(done=1); A100%→100%(done=2); внук→422 — все PASS.
- [x] **2.5·13 (бэк) — ЗАКРЫТ ✅ LIVE (смоук 9/9)** — связь «выполнил привычку → прогресс цели»:
  **кросс-домен ВНИЗ** (ADR-0050). `CompleteTaskUseCase` (привычки) на реальном переходе complete
  (`transitioned`) у задачи с `goalId` зовёт `AccentGoalDomainService.addProgressFromHabit` (HabitsModule
  импортит GoalsModule — **без цикла**: Goals не знает Habits). `addProgressFromHabit` — **best-effort/
  молчаливый**: скип, если цель не найдена/не active/не accumulate (выполнение задачи не падает); прогресс
  = `doneValue` (binary=1); авто-завершение цели внутри `addEntry`. `complete` теперь отдаёт `transitioned`
  (идемпотентность — один раз на переход; повтор/гонка не двоят). **Смоук:** +20→цель 20/20%, повтор=20
  (идемпотентно), binary→+1, reach/reduce скип (80 без изм.), пауза цели не ломает задачу (201) и не двигает
  цель — все PASS. **🎉 ВЕСЬ БЭК ЦЕЛЕЙ (·1–·13) ЗАКРЫТ И ПРОВЕРЕН ЖИВЬЁМ.** (revoke прогресса при uncomplete —
  TODO под 2.9 вместе с очками.)

**Фронт (7 шагов):**
- [x] **2.5·14 (фронт) — ЗАКРЫТ ✅ (tsc app)** — типы в `accent.types`: `GoalDirection`/`GoalStatus`/
  `GoalForecast` + labels/descriptions; `GoalView` (базовая) + `GoalProgressView` (+currentValue/%/forecast/
  rollup/subgoals); `GoalPayload`/`GoalUpdatePayload` (direction/startValue/parentGoalId иммутабельны в update);
  `GoalEntryView`/`Payload` + `AddGoalEntryResult`; `MilestoneView`/`Payload`. `accent-api`: list/get/create/
  update + archive/restore/pause/resume + entries (add/list cursor) + milestones (list/add/remove). tsc app зелёный.
- [x] **2.5·15 (фронт) — ЗАКРЫТ ✅ (prod-сборка strictTemplates)** — `GoalsComponent` (`/accent/goals`):
  карточки с прогресс-баром `%`, forecast-чипом (проективный тон), бейджем рода (Накопить/Достичь/Снизить),
  статусом, rollup-строкой «N из M подцелей»; фильтры по статусу (активные/достигнутые/пауза/архив/все);
  пустой экран с CTA. Роут `goals` → `GoalsComponent` (заменил `AccentPlaceholderComponent`) — **закрыта
  P2.3 «мёртвая вкладка»**. Кнопка «Создать» — TODO-стаб под модалку ·16. Фильтр по сфере — отложен в ·21
  (полировка). Браузер-клик — за Elmir.
- [x] **2.5·16 (фронт) — ЗАКРЫТ ✅ (prod-сборка)** — `GoalFormModalComponent`: reactive-форма (название/зачем/
  род/единица/цель/старт/срок/сфера/атрибуты/родитель/fallback). В **edit** `direction`/`startValue`/
  `parentGoalId` иммутабельны (скрыты/readonly, зеркало ADR-0052). Клиентская валидация (accumulate target>0;
  reach/reduce target≠start) + дружелюбные ошибки; сферы/атрибуты/родители из API. Врезана в кнопку «Создать»
  (create) + `openEdit` (для ·17). Браузер-клик — за Elmir.
- [x] **2.5·17 (фронт) — ЗАКРЫТ ✅ (prod-сборка)** — `GoalDetailComponent` (`/accent/goals/:id`): визуализация
  %/forecast/темп/прогноз-даты; **запись прогресса в один тап** (accumulate +N / reach-reduce замер; авто-
  завершение из ответа бэка); история записей с cursor («Показать ещё»); кнопка «Изменить» (модалка). Для
  rollup-целей запись скрыта. Карточки списка → routerLink на детальный экран; роут `goals/:id`. Браузер — за Elmir.
- [x] **2.5·18 (фронт) — ЗАКРЫТ ✅ (prod-сборка)** — секция «Вехи» в `GoalDetailComponent`: список с
  состоянием «достигнута» (✓/○, вычисляется бэком), добавление (название+порог), удаление только не
  достигнутой. Форма скрыта для не-active целей.
- [x] **2.5·19 (фронт) — ЗАКРЫТ ✅ (prod-сборка)** — секция «Подцели» в `GoalDetailComponent` (для корневых
  целей): список детей со ссылкой и %, кнопка «+ Подцель» → модалка с предзаданным родителем
  (`presetParentId` в `GoalFormData` фиксирует родителя и прячет его выбор). Глубину сторожит бэк (422).
- [x] **2.5·20 (фронт) — ЗАКРЫТ ✅ (prod-сборка)** — **lifecycle-меню «⋯»** в `GoalDetailComponent`
  (пауза/снять/архив/восстановить по статусу; document-click+Esc) + **привязка привычка↔цель**: select
  «Вклад в цель» в форме привычки (только активные accumulate-цели; goalId в форму/payload/префилл). Это
  делает кросс-домен ·13 доступным из UI (выполнил привычку → прогресс цели).
- [x] **2.5·21 (фронт) — ЗАКРЫТ ✅ (prod-сборка)** — фильтр по сфере в списке целей (select из каталога
  доменов; листинг с `?domain`), статус-чипы крутятся горизонтально на узких экранах (`appHscrollHint`).
  Пустые состояния/тон forecast/единый стиль с habits/micro-wins учтены по ходу ·15–·20. **🎉 ВЕСЬ ФРОНТ
  ЦЕЛЕЙ ·14–·21 ГОТОВ** (prod-сборки зелёные). Осталось: переразбитый хвост ниже (путь к 10/10 + `2.5·FINISH`).

### Хвост 2.5 переразбит → путь «фича-в-фиче ЦЕЛИ до 10/10 по трём шляпам» (реш. Elmir 2026-06-24)

> **Зачем переразбивка:** цели — фича внутри фичи (Акцент). Доводим её до 10/10 по всем трём шляпам
> (системный/бизнес/помощь людям) ещё ДО деплоя. **Резюмируемость («выжить между лимитами»):** каждый
> шаг самодостаточен — холодный старт поднимает работу с первого незакрытого пункта.
>
> **Перенумерация:** старый `·22 деплой` → **`2.5·FINISH`** (в самый конец); старый `·23 ретро` →
> **`2.5·22`**; новые шаги **·23…·27**. Решения по дизайну (фокус ·24, mission-filter ·25) — это
> продуктовые развилки Elmir → закрепляются ADR при постройке (CLAUDE.md: ToT-итог = ADR).
>
> **Сводка комбо-решений (Elmir, 2026-06-24):** ① Фокус = **A+C** (одно поле `focus_order`: фокус-флаг
> + порядок); ② Mission-filter = **A+B** (мягкая подсказка всегда + условно-обязательное «ради чего
> откажусь» при заводе в фокус); ③ `maintain` = **в плане, но отдельным выверенным шагом** (·26).

- [x] **2.5·22 (ретро 2.5 в 3 шляпы, был `·23`) — ЗАКРЫТ ✅** → [docs/retro-phase2-2.5.md](./retro-phase2-2.5.md).
  Архитектура чистая (grep-аудит), весь бэк live-verified, весь фронт prod-сборками.
  **+ FIX-ПРОХОД (Elmir «фиксим все», 2026-06-23): исправлено 8/8 находок** (P1 fallbackVersion виден ·
  P2#2 uncomplete-откат прогресса цели, миграция **0016**, смоук 4/4 · P2#3 батч-агрегат против N+1,
  смоук 9/9 (5 запросов вместо O(N)) · P2#4 блок «Цели в работе» на дашборде · P3#5 эндпоинт `/children` ·
  P3#6 reduce-тон · P3#7 rollup/записи не смешиваются · P3#8 forecast-хинт). **+ патчи 8/9:** правка/
  удаление записи прогресса + график-спарклайн (патч 8) и **стартер-пак целей** (патч 9, инертная витрина
  ADR-0051, live-смоук 7/7). Миграции до **0017**. Всё — boot/live/prod-сборки зелёные.

- [x] **2.5·23 (ТРИАЖ «цели не совсем работают») — ЗАКРЫТ ✅ (2026-06-24).** Полный анализ кодовой базы
  целей (методология Elmir: анализ-подпункты `·23.A*` находят баги → реестр → фиксы; подробный реестр
  `triage-2.5-goals.md` сыграл роль и удалён — история в git). **Итог: 9 находок, все разобраны:**
  - **F#1** 🔴→✅ формы записи/вехи не сабмитились (`ngSubmit` без `[formGroup]`) — подтв. браузером.
  - **F#2** 🟠→✅ вехи не обновлялись реактивно после записи — подтв. браузером.
  - **F#3** 🟠→✅ переход между целями не перезагружал экран (`snapshot.paramMap`) — подтв. браузером.
  - **F#4** 🟠→✅ `forecast=behind` при f=0 вместо `null` (ADR-0052/анти-стыд) — подтв. браузером.
  - **F#5** 🟡 `pace` для reach/reduce бессмыслен — не выводится, не правим.
  - **F#7/F#8** 🟠→✅ тихое глотание ошибок + ловушка «+ Подцель» (сёрфинг ошибок + гард) — подтв. браузером.
  - **F#9** 🟠→✅ с подцели не было «к родителю» — кнопка «↑ К родительской цели» — подтв. браузером.
  - Анализ A1–A5 (фронт/бэк-прогресс/записи-lifecycle-права/границы слоёв) — чисто, бэк-домен крепкий.
  **Остаток (🟡, НЕ блокеры, в общий UX-проход):** крошка с заголовком родителя, тост-паттерн для тихих
  ошибок вне goal-detail, проактивное скрытие «+ Подцель». **DoD выполнен:** все 🔴/🟠 исправлены и
  подтверждены браузером Elmir'а. Все фиксы — prod-build/tsc зелёные, закоммичены.

- [x] **2.5·24 (ФОКУС целей, anti-sprawl — combo ①A+C) — ЗАКРЫТ ✅ (2026-06-24).** Все 7 под-шагов
  закрыты (·24.1 ADR+env → ·24.7 свод); бэк live-смоук 7/7 + read-путь подтверждён; tsc/prod-build зелёные.
  Поле `goals.focus_order` (int, null): `null` =
  активна-но-не-в-фокусе, не-`null` = в фокусе + ранг. Даёт И мягкий фокус (предупреждение при >N,
  env-дефолт **3**, **без блока**), И порядок внутри фокуса. Список: секция «В фокусе» (сорт по
  `focus_order`) сверху. **Решения Elmir (2026-06-24):** механизм A+C; порог N=3 по умолчанию, **настраивается
  через env** `ACCENT_GOAL_FOCUS_SOFT_LIMIT`. Шляпы: бизнес+помощь+миссия (тренирует выбор, ADR-0049).
  **Разбит на резюмируемые под-шаги (выжить между лимитами):**
  - [x] **·24.1 — ADR + env — ЗАКРЫТ ✅ (2026-06-24).** [ADR-0053](./decisions/0053-goal-focus-and-mission-filter.md)
    (фиксирует A+C, N=3, env; общий с ·25 mission-filter). `ACCENT_GOAL_FOCUS_SOFT_LIMIT`
    (`z.coerce.number().int().positive().default(3)`) добавлен в `env.schema.ts`. Гигиена env закрыта:
    `ACCENT_GOAL_MAX_DEPTH` + новый задокументированы комментариями в `.env.example` и `.env.prod.example`.
    tsc зелёный.
  - [x] **·24.2 — БД + схема + интерфейсы — ЗАКРЫТ ✅ (2026-06-24).** Миграция `0018` (`goals.focus_order`
    integer, nullable). `goals.schema.ts` +`focusOrder` (+импорт `integer`); `GoalFull`/`GoalView` +`focusOrder`;
    маппер `toGoalView`. `GoalProgressView` тянет автоматически (`GoalView & GoalProgress`). Миграция применена
    на dev (колонка проверена), tsc зелёный.
  - [x] **·24.3 — порт + репозиторий — ЗАКРЫТ ✅ (2026-06-24).** Порт `AccentGoalRepositoryPort` +
    `setFocus(id, acc, order)` / `clearFocus(id, acc)` / `countFocused(acc)` / `maxFocusOrder(acc)`.
    Drizzle-реализация в `accent-goal.repository.ts` (countFocused/maxFocusOrder через `isNotNull(focus_order)`).
    tsc зелёный.
  - [x] **·24.4 — домен + use-case + контроллер — ЗАКРЫТ ✅ (2026-06-24).** Домен `toggleFocus` (ранг
    `maxFocusOrder+1`; идемпотентно если уже в фокусе; `{focusedCount, softLimit, overLimit}`, НЕ блок;
    пример→`ValidationError`). `ToggleGoalFocusUseCase` + интерфейс `GoalFocusResult`. Эндпоинты
    `POST/DELETE /accent/goals/:id/focus`. `list`/`get` отдают `focusOrder` (через `GoalView`). DTO не нужен
    (тело пустое). **Live-смоук 7/7:** order 1→4, overLimit при 4>3, идемпотентность, unfocus→null,
    фокус примера→400, softLimit=3 из env. tsc зелёный.
  - [x] **·24.5 — фронт: тип + API + список — ЗАКРЫТ ✅ (2026-06-24, ждёт браузер-смоук Elmir).**
    `GoalView` +`focusOrder` + тип `GoalFocusResult`; `accent-api` `focusGoal`/`unfocusGoal`. `goals.component`:
    секции «⭐ В фокусе» (сорт по `focusOrder`) + «Остальные» (карточка вынесена в `<ng-template>` через
    `NgTemplateOutlet` — без дублирования); кнопка-звезда (★/☆) на карточке (для non-starter active/в-фокусе);
    `toggleFocus` реактивно `_load()` (без F5); при `overLimit` — мягкая инфо-модалка (не блок). Prod-build зелёный.
  - [x] **·24.6 — goal-detail toggle + дашборд — ЗАКРЫТ ✅ (2026-06-24).** В меню «⋯» детали — пункт
    «⭐ В фокус / ☆ Убрать из фокуса» (`toggleFocus`, реактивно, overLimit→мягкая подсказка); бейдж
    «⭐ В фокусе» в шапке. Дашборд «Цели в работе» сортирует фокусные первыми + ⭐-маркер. Prod-build зелёный.
  - [x] **·24.7 — верификация + свод — ЗАКРЫТ ✅ (2026-06-24).** Бэк-смоук 7/7 (·24.4) + read-путь
    подтверждён: GET list/single отдают `focusOrder` (Alpha=1, Beta=null). tsc + prod-build зелёные.
    **·24 (ФОКУС) ЗАКРЫТ** (ждёт лишь браузер-смоук Elmir по ·24.5/·24.6 UI). Переход к ·25.
  - **Примечание:** ручной drag-порядок внутри фокуса — это `·27` (общий drag-reorder); в ·24 порядок
    задаётся при добавлении в фокус (`maxFocusOrder+1`), перетаскивание подключится в ·27.

- [x] **2.5·25 (MISSION-FILTER для accumulate — combo ②A+B) — ЗАКРЫТ ✅ (2026-06-24).** ADR-0053 (общий
  с ·24). **·25.1 (бэк):** колонка `goals.tradeoff` (миграция 0019, text null) + схема/интерфейсы/view/
  create+update DTO/порт/репо/use-case; домен `toggleFocus` требует `tradeoff` при заводе accumulate в
  фокус (иначе `ValidationError`; reduce/reach не требуют). Live-смоук 4/4 (accumulate без tradeoff→400, с
  tradeoff→201, reach→201, дозаполнить PATCH→201). **·25.2 (фронт):** `GoalView`/payloads +`tradeoff`;
  модалка — для accumulate мягкая подсказка «про важное или “делать больше”?» + поле «ради чего откажусь»
  (max 280, edit прелоадит, payload шлёт); ошибка фокуса сёрфится (F#7). Заодно `showStart`/`isAccumulate`
  → реактивный сигнал `_direction` (чинит подвисание при смене рода). prod-build/tsc зелёные. **·25.3:**
  свод; браузер-смоук UI за Elmir. **·25 ЗАКРЫТ.** Следующий — ·26 (maintain).

- [x] **2.5·26 (`maintain` — 4-й род «удерживать уровень» — combo ③) — ЗАКРЫТ ✅ (2026-06-24).** Модель
  «коридор+adherence» (выбор Elmir), расширение [ADR-0052](./decisions/0052-accent-goal-direction-and-computed-progress.md);
  бэк+фронт, оба пути adherence verified, без миграции. 3 чекпоинта:
  - [x] **·26.1 (бэк) — ЗАКРЫТ ✅ (2026-06-24).** Род `maintain`: коридор `[startValue=ниж, targetValue=верх]`
    (валидация ниж<верх); прогресс = **adherence** (доля замеров в коридоре за окно env
    `ACCENT_GOAL_MAINTAIN_WINDOW_DAYS=30`; нет замеров → `null`); `currentValue`=последний замер;
    forecast/projected/pace=null; **НЕТ авто-completed**; вехи не применяются. Батч-adherence без N+1.
    **Без миграции** (переиспользуем `start_value`/`target_value`). Live-смоук 5/5. tsc зелёный.
  - [x] **·26.2 (фронт) — ЗАКРЫТ ✅ (2026-06-24).** `GoalDirection`+=maintain (label «Удерживать»); форма:
    род в select, подписи границ «Верхняя/Нижняя граница», клиент-валидация ниж<верх; отображение
    `amountLabel` «коридор ниж–верх · сейчас X» (список+деталь), `recordLabel` «Записать замер». % = adherence
    с бэка. Prod-build зелёный.
  - [x] **·26.3 (свод) — ЗАКРЫТ ✅ (2026-06-24).** Оба пути adherence verified: single (`describe`, смоук 5/5)
    + list (батч `maintainAdherenceByAccount`, 3/4=75%). **·26 ЗАКРЫТ** (ждёт браузер-смоук UI). Дальше — ·27.

- [x] **2.5·27 (DRAG-TO-REORDER трекеров — UX, ДО деплоя) — ЗАКРЫТ ✅ (2026-06-24).** Все 3 трекера
  (цели/микро-победы/привычки) — drag-reorder через CDK, server-persist, cross-device. [ADR-0054](./decisions/0054-tracker-manual-reorder-dragdrop.md):
  колонка `position int` per-account на `micro_wins`/`habits`/`goals`; бэкфилл по `created_at`; reorder-эндпоинт
  `PUT /accent/<entity>/reorder {ids}`; **CDK DragDrop** (выбор Elmir; уже в зависимостях); cross-device
  (server-persist, НЕ localStorage); реактивно без F5. **Разбит на под-шаги (goals-first):**
  - [x] **·27.1 — ADR + goals.position — ЗАКРЫТ ✅.** ADR-0054 + миграция `0020` (`goals.position` int,
    бэкфилл `row_number() over (partition by account_id order by created_at)`). GoalFull +`position`.
  - [x] **·27.2 — бэк goals reorder — ЗАКРЫТ ✅.** Порт/репо `reorder` (атомарный UPDATE FROM VALUES) +
    create-append (max+1) + домен + use-case + `PUT /accent/goals/reorder` (204) + DTO; листинг
    `order by position, created_at`. Live-смоук 4/4.
  - [x] **·27.3 — фронт goals drag (CDK) — ЗАКРЫТ ✅ (ждёт браузер-смоук).** CDK `cdkDropList`/`cdkDrag`/
    `cdkDragHandle` (грип ⠿) на «Остальные» (focused — drag-disabled); `dropGoal` оптимистично +
    `reorderGoals(ids)` + откат при ошибке. Prod-build зелёный.
  - [x] **·27.4 — micro-wins + habits — ЗАКРЫТ ✅.** Микро-победы: `micro_wins.position` (миграция `0021`+
    бэкфилл) + бэк reorder + CDK drag. Привычки: drag пишет в **существующий `priority`** (без новой
    колонки/миграции — у привычек уже было ручное упорядочивание) + CDK drag. Оба: грип ⠿, оптимистично+откат.
  - [x] **·27.5 — верификация + свод — ЗАКРЫТ ✅.** Reorder-смоук micro-wins + habits (reverse→204→порядок
    перевернулся). Goals/micro-wins/habits — все drag-reorder работают. **·27 ЗАКРЫТ.** Дальше — ·28 (багхант).
  - **Замечание:** drag-ранг «фокуса» целей (`focus_order`, ADR-0053) можно подключить к тому же DnD позже.

- **2.5·28 (РЕГРЕСС ВСЕГО АКЦЕНТА перед деплоем) — реш. Elmir (2026-06-24): не только цели, а ещё привычки
  и микро-победы.** Две фазы: сначала **я** проверяю всё на баги (код-аудит+смоуки), потом **я даю Elmir
  пошаговый алгоритм регресса** (карты «моё действие / твоё действие»), затем **совместный прогон**. Разбит:
  - **Фаза A — мой баг-аудит (код + curl-смоуки), находки → triage-реестры:**
    - [x] **·28.A1 — Цели — ЗАКРЫТ ✅ (2026-06-24).** Аудит нового (·24–·27). Границы слоёв — чисто.
      Найдено+исправлено: **countFocused считал не-активные** (баг «4 в фокусе при 2», + архив снимает
      focus_order); **G#A1-1** стартер-пак не ставил `position` (примеры вверху) → append (смоук 1–18);
      **G#A1-2** complete не снимал фокус → теперь снимает (pause — нет, временна; смоук completed/null).
      Фокус/mission-filter/maintain/drag/focus-drag — смоучены ранее (·24–·27, 5/5–7/7). Блокеров нет.
    - [x] **·28.A2 — Привычки — ЗАКРЫТ ✅ (2026-06-24).** Границы — чисто. **Блокеров нет.** Новое в 2.5 =
      только reorder (·27.4 через `priority`): **корректно** — задачи дня тоже `desc(priority)`, drag даёт
      единый порядок привычек+будущих задач (фича); сегодняшние задачи держат снапшот priority до след.
      генерации (приемлемо). Reorder НЕ трогает `version`/`ladder` (CAS безопасна). Ядро (лесенка/задачи/
      complete/uncomplete-откат P2#2) — из прод-2.4.20, стабильно; детальный клик-регресс — карта ·28.B2.
    - [x] **·28.A3 — Микро-победы — ЗАКРЫТ ✅ (2026-06-24).** Границы слоёв — чисто. Найдено+исправлено:
      **M#A3-1** (тот же класс, что G#A1-1) — `createMany` стартер-пака **не ставил `position`** → все
      победы получали `position=0` (дефолт) → стартеры всплывали над своими и шли вразнобой. Фикс: `position
      = max+1+index` (зеркало голзовского). Live-смоук (свежий аккаунт, 17 побед): **17 строк / 17 различных
      position 0..16, по порядку**; create→в конец (pos 17); complete идемпотентен по дню (2 запроса→1 лог,
      `completedToday=true`); CHECK energy=5/duration=500→400; reorder→204+порядок; **clear→re-seed: своя
      держится на pos 0, стартеры легли ПОСЛЕ** (исходный симптом устранён). Контроллер: `reorder`/`starter-pack`
      объявлены до `:id` (нет конфликта роутов). Блокеров нет.
    - [x] **·28.A4 — Сквозное — ЗАКРЫТ ✅ (2026-06-24).** **Grep-аудит границ — чисто:** ORM-импорты
      (`drizzle-orm`/`pg`/`$inferSelect`/pg-core) вне `database/` = 0; импорты `database/` в `modules/` —
      только из `*.module.ts` (composition root, разрешено ADR-0030/0034/0050); `DrizzleDatabase`/
      `DatabaseService` в домене = только в комментариях. **Дашборд:** фокусные первыми (стабильная
      сортировка по `focusOrder`, ADR-0053), примеры (`is_starter`) отфильтрованы, pause/resume с модалкой
      ошибки — корректно. **Новый drag-код 2.5** (micro-wins `dropMicroWin`, goals `dropOnFocus`/`dropOnOthers`,
      habits): optimistic + **модалка ошибки + откат через `_load()`**; mission-filter/лимит фокуса
      обрабатываются — корректно. **Конкурентность:** goals без CAS (агрегаты вычисляемы, ADR-0052), reorder
      = last-write-wins по `position` (приемлемо), focus идемпотентен, soft-limit — advisory (`overLimit`-warning,
      не хард-блок). Находка: **X#A4-1 🟡** (пред-существующий, НЕ регресс 2.5) — CRUD-submit/delete в Акценте
      при ошибке СЕРВЕРА молчат (`error: () => undefined` в `_openForm`/`remove` целей/привычек/микро-побед);
      happy-path и клиент-валидация работают, тих лишь редкий путь сервер-ошибки. **ИСПРАВЛЕНО ✅ (2026-06-24,
      реш. Elmir):** 5 точек (submit целей/привычек/микро-побед, delete микро-победы, deactivate привычки) →
      модалка `_modal.error(errorMessage(err))`; `ng build` prod зелёный. Блокеров нет.
  - **Фаза B — карты регресса для Elmir (попунктно, «моё/твоё») — ГОТОВЫ ✅ (2026-06-24):**
    - [x] **·28.B1 — Цели:** карта регресса (A–J + I focus-drag).
    - [x] **·28.B2 — Привычки:** карта регресса (A–G: создание/задачи/лесенка/drag/пак/lifecycle).
    - [x] **·28.B3 — Микро-победы:** карта регресса (A–F: CRUD/complete/состояния/drag/пак, акцент на M#A3-1/E2).
  - **Фаза C — совместный прогон + фикс (Elmir кликает, я смоучу/сверяю БД):**
    - [x] **·28.C — карта «Микро-победы» пройдена ✅ (2026-06-25).** M#A3-1 подтверждён (E1–E5: пак 17 шт по
      порядку, своя выше стартеров); CRUD/complete (дневная идемпотентность)/drag (D1–D4)/валидации (energy 1–3,
      duration 0–300 блокируют кнопку) — работают. **🔴/🟠 НЕТ — регресс микро-побед зелёный.** Находки прогона
      (улучшения, НЕ блокеры) — в бэклоге ниже (M#B3-*).
    - [x] **·28.C — карта «Привычки» пройдена ✅ (2026-06-29)** — зелёная (A–G).
    - [x] **·28.C — карта «Цели» пройдена ✅ (2026-06-29)** — зелёная (A–J).
    - **DoD ·28:** все 🔴/🟠 закрыты, 3 карты зелёные. Только тогда — FINISH.

  - **Бэклог находок прогона (улучшения, НЕ блокеры ·28; решаем/планируем отдельно):**
    > Здесь ведём находки прогона ·28. (Реестр триажа ·23 `triage-2.5-goals.md` сыграл роль и удалён —
    > история F#1–F#9 в git.)
    - [x] **M#B3-1 ❓ Таксономия категорий микро-побед — РЕШЕНО ✅ (2026-06-29, реш. Elmir «D+C», ADR-0056).**
      Признано: это **две разные оси**, не рассинхрон. `category` (модальность «какой сброс», обяз.) остаётся;
      добавлена опц. **`domainKey`** (сфера, общая со целями/привычками) — под будущий «баланс сфер» (2.11+), без
      навязывания achievement-рамки. Развёл коллизию ярлыка (spiritual «🌱 Дух/смысл» → «🧘 Тишина/смысл»). Сквозь
      все слои (миграция 0022); e2e живьём (create+edit со сферой, round-trip БД). Старая формулировка ниже —
      историческая. «Тип нагрузки» (11 кат.) vs «сферы жизни»
      (`accent_domains`, как привычки/цели) — разные оси, у Elmir «нет спорта/работы». Развилка ToT→ADR:
      (a) оставить тип-нагрузки + объяснить; (b) перейти на сферы; (c) две оси. **Нужно решение Elmir.**
    - [x] **M#B3-2 🟡 Контекстные подсказки формы — микро-победы ГОТОВО ✅ (2026-06-25).** Добавлен
      переиспользуемый `FieldGuideModalComponent` + ссылки «что это?» к **названию/длительности/энергии/эффекту**
      (категория уже была). Тексты простые ([[ui-copy-plain-simple]]), без «очков» (их нет до 2.8/2.9); про таймер —
      честно «пока не запускает, в планах» (M#B3-4). Хвост (привычки) — закрыт в **H#B2-1** ✅.
    - [x] **M#B3-3 🟡 Отступы — ГОТОВО ✅ (2026-06-25).** Уточнение Elmir: цель — **общий каркас раздела**,
      не модалка. Корень: **двойной паддинг** — `shell .content` (24/16, на `md` 32/24) + каждая страница
      Акцента (`.mw/.hb/.goals/.gd/.dash`) ещё `padding: 24` → суммарно 48px по бокам на десктопе. Фикс:
      `.content` → 16/12 (моб) и 24/16 (`md`); страницы 24→16 → суммарно 32 по бокам (было 48). **Финал
      (реш. Elmir «меньше воздуха, без магии», и на мобиле тоже):** убрано удвоение — **единый источник
      бокового гуттера = `.content` (12px, `--space-3`, на всех размерах вкл. мобилу)**, страницы Акцента
      (`.mw/.hb/.goals/.gd/.dash`) горизонтально 0 (вертикаль 16). Итог — ровно **12px от края** везде, по шкале
      токенов (без «магического 10»). Бонусом: `_dialog.scss` flush-модалки 24→16 + мобильный media `≤520px`
      (модалка во всю ширину). `max-width: 1180` каркаса оставлен (читаемость строк). `ng build` зелёный.
    - [x] **M#B3-4 💡 Таймер микро-победы — ГОТОВО ✅ (2026-06-29, реш. Elmir).** Кнопка ▶ на карточке (если
      duration>0) → **фокус-модалка** `MicroWinTimerModalComponent`: крупный обратный отсчёт + прогресс на спокойном
      экране (anti-doomscroll — телефон как одна считающая поверхность). «Готово раньше» → засчитать; на нуле —
      мягкий сигнал (Web Audio, опц., 🔔-тоггл, дефолт вкл, localStorage) + «Сделал?» → засчитать/не сейчас.
      Завершение через существующий `completeMicroWin`. Проверено живьём. **Доп. (реш. Elmir): «время на
      подготовку»** — опц. поле `prepSeconds` (миграция 0023, единственное новое поле; null/0 = без подготовки):
      отсчёт ПЕРЕД действием (отложить телефон, встать в планку) → звук «старт» → отсчёт действия → «финиш».
      UI — галочка «Нужно время на подготовку» (не пишется в таблицу) + input. `isTimed` НЕ вводили — все микро-победы
      таймерные. Проверено живьём (фаза подготовки → действие → «Сделал?»). _Статистика таймера — в геймификацию._
    - [x] **M#B3-5 ❓ Серии/стрик микро-побед — РЕШЕНО ✅ (2026-06-29, реш. Elmir «закрыть как отложенное»).**
      Классический стрик («не потеряй серию!», обнуление) = Skinner-box — прямо против анти-выгорания/never-miss-twice
      ([[accent-sustainable-achievement-design]], ADR-0049). **НЕ делаем сейчас.** Вернёмся в геймификации (2.8/2.9)
      ТОЛЬКО в anti-burnout-рамке («постоянство без наказания», без обнуления и давящих формулировок).
    - [x] **H#B2-1 🟡 «Как заполнять» привычек → «что это?» по полям — ГОТОВО ✅ (2026-06-25).** Удалена большая
      справка-простыня (`HabitGuideModalComponent` снесён); `FieldGuideModalComponent` вынесен в общий уровень
      Акцента (`features/accent/`, переиспользуется микро-победами и привычками); в форме привычки «что это?» у
      каждого поля (название/иконка/описание/тип/повтор/лесенка/сфера/вклад в цель/атрибуты/минимум) с точечным
      текстом. 3 текст-поля переведены на единый ручной паттерн. `ng build` зелёный.
    - [x] **H#B2-2 🟡 Дефолт-вкладка «Сегодня» + CTA — ГОТОВО ✅ (2026-06-25).** Вход в «Привычки» теперь
      открывает **«Сегодня»** (`tab` дефолт `today`); при пустом дне — текст + кнопка **«Перейти в шаблоны»**
      (`selectTab('templates')`). `ng build` зелёный.
    - [x] **H#B2-4 🟠 «Сегодня» пуст при заходе/F5 — ГОТОВО ✅ (2026-06-25).** Регресс от H#B2-2: дефолт стал
      «Сегодня», но `constructor` грузил только привычки (`_load`), а задачи — лишь в `selectTab('today')`. При
      входе/обновлении прямо на «Сегодня» список был пуст, пока не переключишь вкладки (Elmir поймал). Фикс:
      в конструкторе `if (tab()==='today') this._loadTasks()`. `ng build` зелёный.
    - [x] **H#B2-5 🟡 Flash лесенки — конкретика + дольше — ГОТОВО ✅ (2026-06-25).** Было: абстрактно «Планка
      выросла, стало сложнее» (какая привычка/что именно — неясно) + авто-скрытие 7с. Обогащён `LadderEvent`
      (движок) → `{ direction, prevTarget, newTarget }`; проброшен через бэк-вью `LadderEventView` и фронт-тип.
      Текст теперь: «🎉 «Стоять в планке»: планка выросла, 20 сек → 30 сек — …» (название + было→стало, «сек» для
      timed). Авто-скрытие 7с→**10с** (+ крестик уже был). nest tsc + ng build зелёные.
    - [x] **H#B2-6 🟡 Flash лесенки не закрывается сам — ГОТОВО ✅ (2026-06-25, реш. Elmir).** Убрано
      авто-скрытие (было 10с): баннер «ты справляешься» висит, пока пользователь не закроет крестиком (успеть
      прочитать похвалу). Поле-таймер удалено, `dismissFlash` упрощён. `ng build` зелёный.
    - [x] **H#B2-7 🟡 Явные «надо/сделано» вместо дроби — ГОТОВО ✅ (2026-06-25, реш. Elmir).** Дробь «295/295»
      на карточке задачи неявная. Заменена на подписи: pending → «По времени · надо: 295»; done/partial → «По
      времени · надо: 295, сделано: 295». Бинарные — без чисел. Знаменатель остаётся **нормой дня** (не целью) —
      анти-выгорание ([[accent-sustainable-achievement-design]]): дробь замкнута на достижимом, а не на далёкой
      цели. `ng build` зелёный. (Опц. на будущее: мягкий контекст «цель: N» отдельной строкой — по желанию Elmir.)
    - [x] **H#B2-8 🟡 Пауза: честный копирайт (C5 = N/A) — ГОТОВО ✅ (2026-06-25, вариант B).** Аудит: секц.
      пауза (`accentPausedFrom`) **только пишет флаг** — в модуле привычек нигде не читается; «серия» = заглушка
      «скоро»; ролловер не реализован (в коде лишь комментарий «cron-ролловер — след. шаги»). Т.е. замораживать
      нечего, кнопка функц. пустая, а дашборд обещал «серии и ролловер заморожены» — вводило в заблуждение
      ([[doc-reflects-reality]]). Фикс (реш. Elmir, вариант B): копирайт смягчён → «На паузе с DATE — вернёшься,
      когда будешь готов» (без обещания механики). Кнопка оставлена (affordance отдыха). **C5 = N/A** на этой
      фазе. **Форвард-таск:** реальная заморозка (пауза гейтит лесенку/серию/ролловер) — в подфазу серий/ролловера
      (≈2.8 геймификация). `ng build` зелёный.
    - [x] **H#B2-9 🟡 Ввод формы теряется при ошибке сохранения — ГОТОВО ✅ (2026-06-26, автономно).** Submit
      перенесён ВНУТРЬ модалок (привычки/цели/микро-победы): форма сама зовёт API через `data.submit`, закрывается
      лишь при успехе; при ошибке остаётся открытой, показывает `formError` и **сохраняет ввод**; кнопка блокируется
      на время сохранения (`busy`, «Сохранение…»). Родители больше не зовут API в `afterClosed` — только reload при
      успехе. Единообразно во всех 3 формах. Тот же класс-баг найден и закрыт в **mission-filter-модалке**
      (G#B1-12): `updateGoal(tradeoff)` звался после её закрытия → offline терял ввод, `focusBusy` залипал,
      ошибка молчала — `save` перенесён внутрь `FocusTradeoffModalComponent` + `.catch` на оба вызова
      `_ensureTradeoff`. Кнопки сохранения форм переведены на общий `[loading]`-спиннер. Сетевой обрыв (status 0)
      теперь даёт человечный текст «Нет соединения…» во всех error-путях. Проверено живьём (offline + happy):
      create + **edit** + mission-filter на всех 3 формах. `ng build prod` зелёный; границы чисты (grep-аудит).
      **Grep-аудит всех `afterClosed`-сайтов** добил пропущенный сиблинг: `goal-detail` (правка цели + «+ Подцель»
      со страницы детали) открывал ту же форму по-старому → починено (форма сама сохраняет; offline-правка цели с
      детали проверена живьём). Последний сиблинг того же класса — `avatar-crop` (профиль, фаза 1) — **тоже закрыт ✅
      (2026-06-29, реш. Elmir «чини», цель — безбаговая 2.5)**: загрузка перенесена внутрь crop-модалки (сама грузит
      через `data.submit`, при сбое остаётся открытой с обрезанным фото, ретрай без пере-кропа); проверено живьём
      (happy + offline-ретрай). Анти-паттерн «модалка→родитель→API» в проекте устранён полностью.
    - [x] **G#B1-1 🟡 «Что это?» по полям формы цели — ГОТОВО ✅ (2026-06-25).** В форме создания/редактирования
      цели не было контекстных подсказок (как у привычек/микро-побед). Добавлены «что это?» ко всем полям
      (название/зачем/ради чего откажусь/род/цель/единица/старт-граница/срок/сфера/атрибуты/родитель/версия на
      плохой день) через общий `FieldGuideModalComponent`; title/unit переведены с `app-text-field` на ручной
      label с help-ссылкой. `ng build` зелёный.
    - [x] **G#B1-2 🟡 Перечисления в гидах — маркированным списком — ГОТОВО ✅ (2026-06-25).** Плотные
      перечисления в «что это?» читались «простынёй». `FieldGuideModalComponent` расширен полем `bullets`
      (термин+пояснение, стилизованный `<ul>` с акцент-маркером). Переведены: род цели (4), тип привычки (3),
      лесенка (5), цена энергии (3). `ng build` зелёный.
    - [x] **G#B1-3 🟡 Блок «зачем раздел» в привычках/целях — ГОТОВО ✅ (2026-06-25).** У микро-побед был
      интро-блок (🌱 «Раздел для тяжёлых дней…»), у привычек/целей — нет. Добавлены зеркальные `aside` сверху:
      привычки 🪜 «Не идеально, а постоянно…» (лесенка/анти-выгорание); цели 🎯 «Большое — измеримым прогрессом…»
      (фокус/отказ от лишнего). `ng build` зелёный.
    - [x] **G#B1-4 🟡 Шкалы у графика «Динамика» — ГОТОВО ✅ (2026-06-25).** Был голый спарклайн без осей.
      Добавлены: Y-ось (max/min значения + единица в подписи «Динамика, ₽»), X-ось (даты первой/последней
      записи), оси-границы (левая+нижняя линии). aria-label с диапазоном для скринридеров. `ng build` зелёный.
    - [x] **G#B1-5 🟡 Ясность дедлайна — ГОТОВО ✅ (2026-06-25).** «Осталось 5 дн.» без даты/ясности →
      «Осталось 5 дн. — крайний срок 30 июн» (показываем и счётчик, и дату; `daysLeft = дней до даты-дедлайна`,
      этот день — крайний). `daysLeft=0` → «Крайний срок — сегодня (дата)». `ng build` зелёный.
    - [x] **G#B1-6 🟠 Тупик завершённой цели — ГОТОВО ✅ (2026-06-25).** Цель авто-завершилась (reached target),
      потом удалил записи прогресса → данных нет, но статус остался `completed`, а форма записи только у `active`,
      и в меню «⋯» завершённой — лишь «В архив». Тупик: ни добавить прогресс, ни «дойти». Корень: на бэке не было
      перехода `completed → active` (только archive). Фикс: новый **reopen** (репозиторий→порт→domain→use-case→
      `POST goals/:id/reopen`, `status='active'`+`completed_at=null`) + фронт (`reopenGoal`) + кнопка
      **«↩ Вернуть в работу»** в меню завершённой. **+ Авто-возврат (ревизия F#4, реш. Elmir):** `_syncCompletion`
      в `removeEntry`/`updateEntry` — если правка/удаление записей уронила завершённую цель ниже target →
      статус сам в `active` (и наоборот: правка вверх у active→completed). Убирает противоречие «completed + <100%».
      Застрявшую цель Elmir (604/1000) поправил в БД вручную. nest tsc + ng build зелёные.
    - [x] **G#B1-7 🟠 График ApexCharts не рисовался при записях за один день — ГОТОВО ✅ (2026-06-26).**
      При `datetime`-оси точки с одинаковой датой схлопывались в один X → линия «пустая» (Elmir: «график не
      изменился»; в БД все 5 записей были на 2026-06-25). Фикс: ось → **`category`** (разносит точки по порядку,
      дату — подписью `DD.MM`) + видимые **маркеры** точек. Робастно и для реальных, и для тестовых данных
      (несколько замеров в день). `ng build` зелёный.
    - [x] **G#B1-8 🟡 Инлайн-валидация полей формы цели — ГОТОВО ✅ (2026-06-26, A5, реш. Elmir).** Числовые
      ошибки (цель=0 у «Накопить», цель=старт у reach/reduce, нет нижней / нижняя≥верхняя у maintain) показывались
      одним общим сообщением внизу. Перенесены к полям: `targetError` под «Цель/Верхняя граница», `startError`
      под «Старт/Нижняя граница» — видно, какое поле править. `ng build` зелёный.
    - [x] **G#B1-9 🟡 Коридор на графике «Удерживать» — ГОТОВО ✅ (2026-06-26).** `app-chart` получил опц.
      `corridor={lower,upper}` → закрашенная y-аннотация (зона коридора + подпись); maintain прокидывает границы.
      Видно, в коридоре замер или вышел. `ng build` зелёный.
    - [x] **H#B2-3 🟡 Метка «⤴ со вчера» на перенесённой задаче — ГОТОВО ✅ (2026-06-26).** Бэк: `TaskView`
      получил `carriedFromPostpone` (derive из `postponedFromTaskId !== null`); фронт: тип + бейдж «⤴ со вчера»
      на карточке задачи в «Сегодня». nest tsc + ng build зелёные. Задача, всплывшая из вчерашнего переноса
      (`postponed_from_task_id != null`), выглядит как обычная pending — не видно, что она «со вчера» (Elmir в B7:
      «не вижу, что конкретно была перенесена»). Механика верна, не хватает маркера. Фикс: бэк — отдать в `TaskView`
      флаг `carriedFromPostpone` (derive из `postponedFromTaskId !== null`); фронт — мелкий бейдж «⤴ со вчера» на
      такой задаче. Малый back+front.

  - **🧾 ХВОСТ ·28 — ПОЛНОСТЬЮ ЗАКРЫТ ✅ (2026-06-29).** **Резюме ·28:** 3 карты ЗЕЛЁНЫЕ (цели A–J / привычки
    A–G / микро-победы A–F), ~26 находок исправлены. (Сами карты регресса `test-map-*.md` удалены как
    отработавшие — история в git.) Все хвостовые пункты разобраны:
    - [x] **H#B2-9** — ввод формы не теряется при ошибке (3 формы + деталь цели + mission-filter); закрыт 2026-06-26.
    - [x] **M#B3-1** — две оси таксономии микро-побед (D+C, ADR-0056); решён 2026-06-29.
    - [x] **M#B3-4** — таймер микро-победы (фокус-модалка); сделан 2026-06-29.
    - [x] **M#B3-5** — серии/стрик: решено НЕ делать (Skinner-box vs анти-выгорание); → 2.8/2.9 в anti-burnout-рамке.
    - _Тех-долг-флажок `avatar-crop` (фаза 1) — тоже закрыт 2026-06-29 («чини», безбаговая 2.5). Открытого по ·28 не осталось._
    - _(Демо-данные на localhost-стенде НЕ чистим — это песочница, на прод не влияет; реш. Elmir 2026-06-26.)_

- [x] **2.5·FINISH — ВЫПОЛНЕНО ✅ (2026-06-29).** `VERSION` 2.5.0-dev → **2.5.0**, `release-2.5.0.md` + broadcast
  (ключ `release-2.5.0`), `prod-build/up` (migrate-гейт прогнал 0022+0023), prod-smoke зелёный (`/version` =
  `{"product":"2.5.0","commit":"6cf019a"}` HTTP 200, нота засеяна, живой трафик). Прод **2.4.20 → 2.5.0**.

- [x] **2.5.1 — позиция «прыгает» после редактирования (drag-списки) — ГОТОВО ✅ (2026-06-29).** Симптом (нашёл
  Elmir на проде): отредактировал микро-победу → карточка ушла в конец ручного списка. **Корень:** на проде весь
  стартер-пак имеет `position=0` И **один и тот же** `created_at` (батч-вставка) → `ORDER BY position, created_at`
  при полном равенстве ключей **недетерминирован**; UPDATE создаёт новую версию строки в куче → при неупорядоченном
  скане она «всплывает» (обычно в конец). **Фикс:** стабильный тай-брейкер `asc(id)` (uuidv7 ≈ порядок вставки) в
  `ORDER BY` всех drag-списков — `micro_wins` (position+created_at), `goals` (position+created_at) и её подцели,
  `habits` (priority+created_at, drag пишет в priority). Низкий риск, чинит при любых ничьих, бэкфилл позиций не
  нужен. nest tsc зелёный. Патч **2.5.1** → прод.

### 🐞 Баги/долги к разбору (зафиксировано перед 2.6, 2026-06-30)
> Найдены Elmir на прод-деве; системный анализ ниже. Не блокируют старт 2.6, но «не потерять».

- [x] **BUG-1 🔴 Вход на новом устройстве выкидывает другое (кросс-девайс «кик») — ЗАКРЫТ В КОДЕ (2.5.3).** Симптом: логин Chrome@iPhone → кикает Chrome@MacBook, и наоборот. **Бэк (908e610): грейс + per-session revoke; фронт best-form: единый single-flight + Web Locks между вкладками. Live-прогон по решению Elmir не делаем — валидация деплоем.**
  - **Гипотеза «одинаковый fingerprint» — НЕ подтверждается:** `sessions` ключуются по `token_hash` refresh-токена, не по fingerprint/UA (`user_agent` — лишь для опознания устройства).
  - **Анализ:** `LoginAccount → createSession` просто **вставляет новую строку** (новый `sessionId` + opaque refresh), чужие сессии **не трогает** (нет unique-по-account, нет revoke) → сам вход кикать не должен.
  - **Вероятный истинный корень:** reuse-detect ([ADR-0046](./decisions/0046-refresh-reuse-detection-and-recovery-posture.md)) при архивном/отозванном токене или проигрыше CAS-ротации зовёт **`revokeAllByAccount` (отзыв ВСЕХ сессий)**. Свежезалогиненное устройство шлёт **два параллельных `/auth/refresh` тем же токеном** (гонка app-init + 401-ретрай интерцептора / двойной маунт) → 1-й выигрывает CAS, 2-й предъявляет уже архивный → reuse → **revoke-all → кик другого устройства**. Симметрия «и наоборот» сходится.
  - **✅ ПОДТВЕРЖДЕНО ДАННЫМИ ПРОДА (2026-06-30, johanna):** у `elmir_kuba` **44 сессии, 0 активных**; в `sessions` видны **парные revoke в одну минуту** (напр. 06-30 15:24 разом отозваны Mac-сессия от 15:07 и Windows от 06:39 при входе с iPhone) = `revokeAllByAccount`; **172** строки `session_token_history`. Т.е. почти каждый вход/refresh нукает остальные устройства → аккаунт не держит больше ~1 живой сессии. Баг системный, не редкий.
  - **Решение (ADR-уровень — согласовано), два слоя:** (б) бэк — смягчить reuse-detect: **грейс-окно 15с** + отзыв **только реплейнутой сессии**, не всех (ревизия [ADR-0046](./decisions/0046-refresh-reuse-detection-and-recovery-posture.md)) — предохранитель; (а) фронт — **устранить гонку в корне**: единый источник ротации на всё приложение с single-flight внутри вкладки + **Web Locks между вкладками**, чтобы устройство слало не более одного `/auth/refresh` за раз.
  - **✅ БЭК СДЕЛАН (2026-07-01, 908e610):** `SessionDomainService.rotateSession` — грейс `REUSE_GRACE_MS=15_000`: архивный токен в пределах грейса → мягкий 401 без отзыва; вне грейса → `revokeById` только той сессии; проигрыш CAS → мягкий 401. `revokeAllByAccount` в reuse-detect **убран** (grep: остались лишь recovery/delete/deactivate). Контроллер на 401 refresh cookie не чистит (не затирать токен победителя).
  - **✅ ФРОНТ СДЕЛАН best-form (2026-07-01):** новый `TokenRefreshService` — единый single-flight (мемо промиса в вкладке) + `navigator.locks` между вкладками; и `auth.interceptor.ts` (на 401), и `session-initializer.ts` (на старте) ротируют только через него → benign-гонка двойного refresh исключена в корне. Старый разрозненный `refresh$` в интерцепторе удалён. nest tsc + angular tsc + `ng build prod` — зелёные. Аудит всей подсистемы (guard/IDOR/cookie/delete-flow/утечки) пройден, других багов сессий не найдено.
  - **Валидация:** live 2-девайс repro Elmir решил не гонять (доверие коду) — реальной проверкой служит деплой 2.5.3. Рецепт при необходимости (можно с `ACCESS_TTL=15s` для форсажа): Mac+Win под одним аккаунтом висят пару минут → обе живы; в БД нет парных revoke; кража (старый токен >15с) → revoked только та сессия.
- [x] **BUG-2 🟠 Нет старт-даты привычки → нельзя «через день»/чередовать — ЗАКРЫТ (2.5.3).** Симптом: «каждые N дней» N=2 — хочу две привычки в противофазе, но обе от сегодня попадают на одни дни; вторую пришлось бы заводить завтра.
  - **Анализ — ПОДТВЕРЖДЕНО:** якорь RRULE = дата создания (`dtstart = localYmd(habit.createdAt, timezone)` в `accent-task.domain-service.ensureTasksForDay`). Утилита якорь уже принимает (`isHabitDueOn(recurrence, dtstart, date)`), но в схеме `habits` **не было пользовательского поля старт-даты** → фаза INTERVAL-правил жёстко на `created_at`.
  - **✅ Фикс (бэк):** колонка `habits.start_date` (date, nullable) + миграция `0024_habit_start_date`; домен `ensureTasksForDay` берёт `dtstart = habit.startDate ?? localYmd(createdAt, tz)`; DTO create/update — `startDate?` (`YYYY-MM-DD`, zod regex+refine); `HabitView` отдаёт `startDate`. Бэкфилл не нужен (null → фолбэк на `created_at`).
  - **✅ Фикс (фронт):** в форме привычки чекбокс **«Начать не сегодня?»** раскрывает поле «Начать с» (date, дефолт сегодня); на сохранении `startDate = галка ? дата : null`. Чередование «каждые N дней» = сдвиг старт-даты на день (противофаза). `HabitPayload`/`HabitView` несут `startDate`. nest tsc + `ng build prod` зелёные.
- [x] **BUG-3 🟠 Модалка цели не адаптивна (нет кнопки/скролла на низком/узком вьюпорте) — ЗАКРЫТ (2.5.3).** Симптом (Elmir): на малой высоте+ширине форма создания/редактирования цели обрезается, кнопки «Сохранить» нет и контент не прокручивается → цель не создать.
  - **Корень:** `GoalFormModalComponent` открывался с `panelClass: 'modal-flush'` (surface `overflow:hidden`, `padding:0` — рассчитан на внутренний скролл-каркас `.dlg`), но верстался плоской `.gf`-формой без каркаса. Привычки и микро-победы уже используют общий `.dlg`/`.dlg__body`/`.dlg__foot` (`styles/_dialog.scss`) → у них шапка/футер фиксированы, тело скроллится. Отсюда «scss не похож на другие модалки».
  - **✅ Фикс:** модалка цели переведена на тот же общий каркас `.dlg` (head/form/body/foot); контент скроллится в `.dlg__body`, «Сохранить» в фикс-`.dlg__foot`. Поле-стили `.gf__*` сохранены. `ng build prod` зелёный.
- [x] **BUG-5 🟠 Перенос «→ Завтра» ДУБЛИРУЕТ ежедневную/через-день привычку — ЗАКРЫТ (`34e0f34`, найден на проде Elmir 2026-07-19).** Симптом: перенёс ежедневную задачу на завтра → назавтра в «Сегодня» она фигурирует ДВАЖДЫ (перенесённая + свежематериализованная). Репро на «через день»: перенёс дважды (на off-день, потом на due-день) → на due-дне тоже две.
  - **Корень:** `AccentTaskDomainService.postpone` создавал завтрашнюю копию с `templateId=null` (умышленно — «обойти уник `(template_id, occurred_on)`»), поэтому копия НЕ занимала слот привычки. Назавтра `ensureTasksForDay` (материализация, `createMany` c `onConflictDoNothing`) видела свободный слот и создавала ВТОРОЙ инстанс. NULL в Postgres-уник-индексе не конфликтует → дубль.
  - **✅ Фикс:** переносимая копия **наследует `templateId`** исходной задачи (для привычки → занимает слот → материализация пропускает по `onConflictDoNothing`); + гард: если завтра уже есть инстанс этой привычки (материализованный/ранее перенесённый) — не плодим, закрываем исходную и возвращаем существующий. Разовые (`templateId=null`) — как были. `postponedFromTaskId` сохранён (метка «со вчера» работает). tsc зелёный; live-verified через API: было 2 → **стало 1**.
  - **Хвост (решение Elmir 2026-07-19: забить, не трогать):** уже задвоённые строки на проде (созданные до фикса) НЕ чистим — оставляем как есть, ручной cleanup не делаем. Фикс не даёт появляться новым; пара старых дублей некритична. Будущим сессиям — не предлагать чистку.
### 🧩 2.6 — детальная нарезка: «привычки v2» + «держусь» (3 трека) — спроектировано 2026-07-06
> **📌 Статус: Трек A / FEAT-H1 ГОТОВ** (код+live-verify) — таймер timed-привычек (mode-aware, пауза, остаток+накопление, выбор, prep+миграция 0025). Отгружено 2.5.4/2.5.5.
> **📌 Статус (2026-07-23): Трек B / FEAT-H2 ГОТОВ (код+API-verify)** — полярность лесенки + `clock`-привычки (время суток / отбой). Бэк (`6ab9681`): `_applyLower` зеркальная ветка, `_validateLadder` полярность-зависим, DTO/view direction/anchorMinutes, `clock` в HABIT_KINDS; статус done/partial полярность-зависим (`f351a61`). Фронт (`1145586`): тип «Время суток» → лесенка тайм-пикерами (Не позже/Цель сейчас/Идеал, direction=lower, якорь 18:00), зачёт по введённому времени отбоя, инвертированный фидбэк «сдвигаем отбой раньше», `clock.util` HH:MM↔минуты. **Без SQL-миграции** (jsonb+varchar). API-смоук: create clock ✅, инвариант перевёрнутый (400) ✅, зачёт 02:20≤цели=done / 04:00>цели=partial ✅. **Осталось:** click-verify формы/тайм-пикеров (за Elmir) + деплой (копится к 2.5.7). Docs H2·1 (ADR-0058) закрыты ранее.
> _(Ранее: Docs Трека C — C1: domain-model §7 + api-contracts §7 — закрыты; сам Трек C «держусь» по коду не начат.)_
> **🔖 ВЕРСИИ (реш. Elmir 2026-07-06, гибко):** FEAT-H1 — это **полировка привычек (2.4)**, поэтому шиппится не как 2.6.x, а как **патч «Акцента» → `2.5.4`** (несёт миграцию `0025` — при деплое прогнать `prod-migrate`); фикс звука на iPhone → **`2.5.5`** (✅ закодирован `139ab4d`: персистентный `AudioContext` + `resume()` на первом жесте pointerdown/touchstart вместо свежего контекста вне жеста; tsc+build+smoke 0 ошибок; **финальная проверка — на реальном iPhone за Elmir**; Android/десктоп не задеты). Значит **2.6 = собственно «держусь» (Трек C)** — headline подфазы. То, что разбор FEAT-H1/H2 лежит здесь, в блоке 2.6, — оставляем как есть (норм, Elmir); версия ≠ место в доке. FEAT-H2 (полярность/`clock`) — номер уточним при старте (тоже кандидат в `2.5.x`-полировку или в 2.6). **Прод сейчас `2.5.3`, ничего не задеплоено;** `VERSION` бампается при деплое.
> **Трек C «держусь» — ЗАКРЫТ ПО КОДУ И ВЕРИФИЦИРОВАН** ✅ (C1 дока · C2 БД+миграция 0026 · C3 домен+API live 31/31 · C4 фронт tsc+prod-build · C5 браузер live 19/19). **Не задеплоено** — выкатка бандлом `2.6.0` (бамп `VERSION` + prod-migrate 0026) отдельным решением. Дальше по подфазе 2.6 — Трек A (FEAT-H1) и Трек B (FEAT-H2), уже закодированы ранее; либо деплой 2.6.0.
> 2.6 объединяет **три тематически связанных, но механически независимых** куска под одним
> релиз-поездом `2.6.x` (реш. Elmir 2026-07-06). Тема — «твои отношения с поведением: усиливать /
> ограничивать / воздерживаться». **Важно (честно про связи, проверено по коду 2026-07-06):**
> зависимости по коду между треками НЕТ — каждый трогает свою часть:
> - **Трек A — FEAT-H1** (таймер `timed`-привычек) → переиспользует таймер **микро-побед** (обратный отсчёт), фронт-only.
> - **Трек B — FEAT-H2** (полярность лесенки + `clock`) → трогает `HabitLadder`/`LadderEngine` **обычных** привычек.
> - **Трек C — держусь** (`AntiHabit`+`Relapse`) → **своя** модель (попытка/рецидив/рекорд), свой «живой таймер» — счёт **ВВЕРХ** (`floor((now−startedAt)/сутки)`), лесенку НЕ использует.
> Поэтому FEAT-H2 — **не «фундамент» держусь** (ранняя формулировка была неточной): держусь не зависит от полярности лесенки. Объединяет их **не общий движок, а общий язык anti-burnout-UX** (non-punitive, «годовой тренд ≠ идеальная цепочка», «сдвигаем, не проваливаем») — проектируем UX один раз на B и C. Треки **шиппятся в любом порядке**, каждый = свой `2.6.x`; номера 2.6–2.12 не сдвигаются. Линза нарезки — 3 шляпы (бизнес/система/человек).
> **♻️ Resumable (чтобы не терять между сессиями/лимитами):** каждый под-пункт ниже самодостаточен и несёт контекст — путь к файлу, файл-эталон для копирования паттерна, инвариант. Отмечай `[x]` по мере. При обрыве сессии новая открывает этот блок и продолжает **с первого незакрытого `[ ]`**; шаги внутри трека идут сверху вниз (B→S→A→verify), но зависимостей между треками нет. Feature-first слайс: `nest/src/modules/accent/anti-habits/{controllers,use-cases,domain-services,adapters,interfaces,dtos,anti-habits.module.ts}`; ORM — только в `nest/src/database/{schemas,repositories/accent}`; миграции `nest/drizzle/00XX_*.sql` (следующая — `0025`); фронт — `angular/src/app/features/accent/anti-habits/`.

#### Трек A — FEAT-H1 🟢 Таймер/секундомер для `timed`-привычек _(бывш. «BUG-4» — переклассифицировано: это ФИЧА, не баг)._
- **Бизнес (боль/ценность):** `timed`-привычки (ходьба на беговой дорожке, медитация N мин, планка, растяжка, чтение, холодный душ) имеют целевую ДЛИТЕЛЬНОСТЬ, но нет способа прямо в приложении её отсчитать. Ценность: превращает «число в карточке» в ведомую фокус-сессию; переиспользует уже проверенный таймер микро-побед. Приоритет — малый объём / частый пользовательский паттерн.
- **Система (спека/edge):**
  - Модель — **без изменений БД**: `HabitKind='timed'` уже есть (target = секунды); источник длительности — `ladder.currentTarget` на сегодня (дефолт обратного отсчёта), с ad-hoc-переопределением прямо в модалке (закрывает развилку 1: берём из лесенки, разрешаем override).
  - Завершение (развилка 2): доотсчёт → предложить «зачесть» → отметка задачи привычки за день через **существующий** эндпоинт complete (`performed = отсчитанные секунды` ≥ target) → лесенка сама подстроится. Cancel — ничего не пишет. **Новых эндпоинтов не нужно.**
  - Переиспользование: обобщить [`micro-win-timer-modal.component.ts`](../angular/src/app/features/accent/micro-wins/micro-win-timer-modal.component.ts) (уже generic по `MicroWinTimerData`) в общий `accent`-таймер (микро-победы продолжают работать). MVP — обратный отсчёт до target; count-up (открытый) — позже.
  - Edge: ролловер дня во время отсчёта; уход из модалки; общий ключ звука.
- **Человек:** спокойный экран фокуса (как у микро-побед — «интерес, не страх»); финиш = победа, отмена не наказывается.
- **Нарезка (сперва дока, потом фронт; бэкенд не трогаем) — resumable подпункты:**
  - **H1·1 (docs):**
    - [x] H1.1a `ui-ux`: доступность таймера для `timed`-привычек (кнопка «▶ засечь» на карточке задачи), источник длительности = `ladder.currentTarget` с ad-hoc-override. ✅ 2026-07-06 — добавлено в `docs/sections/accent/ui-ux.md §6`. (Контрактная часть «завершение → complete(performed)» — в H1.1b.)
    - [x] H1.1b зафиксировать семантику завершения: доотсчёт → «зачесть» → существующий `complete(performed=секунды≥target)`; cancel — ничего. ✅ 2026-07-06 — добавлено в `api-contracts` (под `POST /accent/tasks/:id/complete`): «нового эндпоинта/поля не требуется».
    - [x] H1.1c мини-ADR «единый таймер-компонент для трекеров» (микро-победы + привычки). ✅ 2026-07-06 — [ADR-0057](../decisions/0057-unified-tracker-timer-component.md) (+ индекс в `decisions/README.md`). H1·1 (docs) закрыт целиком.
  - **H1·2 (frontend)** — ✅ 2026-07-06 (коммит `07c712a`), tsc + `ng build` prod зелёные:
    - [x] H1.2a таймер вынесен в `accent/shared/accent-timer-modal.component.ts` (`AccentTimerModalComponent`, generic по `AccentTimerData`); микро-победы переведены на него (ключ звука сохранён); старый файл удалён (rename).
    - [x] H1.2b «▶ засечь» на карточке `timed`-задачи (`habits.component.ts`) → таймер с длительностью из поля ввода (override) или снимок `targetValue`.
    - [x] H1.2c завершение → существующий `completeTask(performed=секунды)`; вью обновляется через `_patchTask` (без перезагрузки).
  - **H1·3 (verify):** ✅ 2026-07-06 — live-прогон через реальный UI (Playwright на dev-стеке):
    - [x] H1.3a `timed`-привычка «Планка · надо 10» → «▶ засечь» открыл фокус-таймер (0:09→0:06, отсчёт идёт) → «Готово раньше» → задача **✓ Сделано**, день **0%→100%**, API: `status='done', doneValue=10`. (Лесенка не сместилась — верно: `EASE_THRESHOLD=3`, одно выполнение планку не растит, `ladderEvent=null`.)
    - [x] H1.3b прогон с «Отмена» — задача осталась `pending` (ничего не записано); экран «Микро-победы» рендерится (регресс общего таймера чист); `tsc` + `ng build` prod зелёные.
    - **✅ Доработано 2026-07-06 (реш. Elmir «таймер должен знать, откуда открыт»):** таймер получил `mode: 'binary' | 'duration'`. У `duration` (привычки) кнопка «Готово раньше» → «**Засчитать сейчас**» и возвращает **фактически прошедшие секунды** (частичный зачёт: `partial ≥ minTarget` держит серию), у `binary` (микро-победы) — прежнее полное засчитывание. Live-проверено: «Растяжка·30с» остановлена на 5с → бейдж «Частично 5», API `status='partial', doneValue=5`. Коммит `10d49f7`.
    - **✅ Доработано 2026-07-06 (кейс Elmir «час на дорожке, сделал 30 мин»):** таймер timed-привычки теперь (1) стартует с **ОСТАТКА** = `target − сделано` (не заново); (2) зачёт **НАКАПЛИВАЕТ** (`сделано + прошедшее`, не затирает партиал); (3) **ПАУЗА** в модалке (время замирает, прогресс сохраняется). Frontend-only. Live-проверено: «Растяжка» 5/30 → таймер стартовал 0:24, пауза заморозила (0:24→0:24), продолжил → зачёт «Частично 9» (5+4). Коммит `0c0e399`.
    - **✅ Доработано 2026-07-06 (уточнение Elmir «нужен ВЫБОР сначала/продолжить»):** при повторном «засечь» с прогрессом модалка показывает экран выбора — «▶ Продолжить (остаток)» / «↻ Начать сначала (полная)» / «Отмена» (`resumeSeconds` в данных → фаза `choose`; `fromRestart` в результате → вызывающий заменяет или накапливает). Live-проверено: 9/30 → «Сначала» (0:30) → зачёт заменил на «Частично 4»; затем «Продолжить» (0:26) → накопил «Частично 8». Коммит `b7a8a45`.
    - **✅ Сделано 2026-07-06 (запрос Elmir): опциональное `prepSeconds` у timed-привычки** — full-stack. Бэк: миграция `0025` (`habits.prep_seconds`) + схема/DTO(`.max(3600)`)/интерфейс/порт/репо/вью/use-cases (коммит `bdf6687`). Фронт: поле «Подготовка перед таймером» в форме (только для `timed`) + проброс в таймер по `templateId` (коммит `447888f`). Live-verified: API принял/вернул `prepSeconds:5`; форма показывает поле только для timed (binary→0, timed→1); таймер «Медитация» (prep=5) открылся фазой «Подготовка — приготовься» 0:04→0:02. Миграция накатана на дев; на прод — при деплое (аддитивно, nullable).

#### Трек B — FEAT-H2 🟢 Полярность лесенки + `clock`-kind (сдвиг окна сна)
- **Бизнес:** кейс «отбой не позже 3:00 → 2:30 → 2:00» — лесенка двигает целевое ВРЕМЯ (дедлайн) вниз. Частый пользовательский паттерн (стабилизация сна/режима), для которого сейчас нет модели.
- **Система:** аддитивно — `HabitLadder.direction: 'raise'|'lower'` (дефолт `raise` = текущее); при `lower` успех = `performed ≤ currentTarget`, «подъём» = ужесточение (`−step` к `goalTarget`), инвариант переворачивается. Новый `HabitKind='clock'` = «минуты от вечернего якоря» (midnight-safe) + `anchorMinutes` в jsonb `ladder`. Зеркальная ветка `LadderEngine`. Миграция минимальная (дефолт `direction='raise'` + опц. якорь). DTO/`api-contracts §5` + тайм-пикер на фронте. **ADR** (полярность лесенки + `clock`).
- **Человек:** инвертированный копирайт фидбэка («сдвигаем отбой раньше: 2:30»), не «провалил».
- **💡 Требования из дневникового догфудинга (для `clock`-привычек И журналов 2.8/2.10, зафиксировано 2026-07-09):**
  - **Сутки по циклу сна, не по полуночи:** событие после полуночи, но ДО отхода ко сну, относится к дню пробуждения. Для `clock`-отбоя это уже кодирует «минуты от вечернего якоря» (02:00 — «сегодня», не «завтра»); журналы должны считать день так же.
  - **Батч-ввод задним числом:** отметки/журнал допускают внесение пачкой и постфактум (backfill за прошлые дни), а не только «сейчас».
  - **Частичные/пропущенные дни:** день может быть не отслежен (пометка «?») или частично; пропуск ≠ срыв/ноль (иначе ложный тренд) — согласуется с «минимальная победа держит серию» и non-punitive.
  - **Поля «уточнить»:** возможность оставить inline-флаг неоднозначности прямо в записи (напр. «дубль?»), не блокируя ввод.
  - **Конфаунды среды:** метрику может искажать внешний фактор, не связанный с привычкой (напр. время подъёма зависит от условий сна, а не от режима) → опц. тег/контекст записи, чтобы тренд считался по сопоставимым условиям, а не по шуму.
- **Нарезка — resumable подпункты (⚠️ трогает ядро `LadderEngine` — делать аккуратно, с ADR первым):**
  - **H2·1 (docs+ADR):**
    - [x] H2.1a ADR: полярность лесенки `direction: raise|lower` + `clock`-kind. ✅ 2026-07-06 — [ADR-0058](../decisions/0058-habit-ladder-polarity-and-clock-kind.md) (+ индекс в `decisions/README.md`).
    - [x] H2.1b правки `domain-model §1/§5` (kind `clock`+`LadderDirection`+ladder.direction/anchorMinutes), `gamification §7` (зеркальная ветка движка), `api-contracts §5` (тело привычки). ✅ 2026-07-06. **H2·1 (docs+ADR) закрыт.**
  - **H2·2 (backend)** — эталон/место правки: `nest/src/modules/accent/habits/domain-services/accent-ladder-engine.domain-service.ts`, `interfaces/habit-full.interface.ts`:
    - [ ] H2.2a добавить `'clock'` в `HABIT_KINDS`; `direction: 'raise'|'lower'` в `HabitLadder` (дефолт `raise`) + `anchorMinutes?`.
    - [ ] H2.2b утилита минут ↔ время (от `anchorMinutes`, корректный переход через полночь) + юнит-проверка логикой.
    - [ ] H2.2c зеркальная ветка `_apply` для `direction='lower'`: успех = `performed ≤ currentTarget`; «подъём» = `−step` к `goalTarget`; откат = `+step` к `minTarget`.
    - [ ] H2.2d инварианты домена под обе полярности (валидация лесенки в domain-service) — не сломать текущее `raise`.
  - **H2·3 (БД):**
    - [ ] H2.3a миграция `nest/drizzle/00XX_*.sql`: `ladder.direction` дефолт `'raise'` + опц. `anchorMinutes` (в jsonb `ladder`, без слома существующих привычек) → просмотр SQL → migrate.
  - **H2·4 (API/DTO)** — место: `dtos/create-habit.dto.ts` (`ladderSchema`):
    - [ ] H2.4a расширить zod: `kind` (+`clock`), `ladder.direction`, `anchorMinutes` (closed-shape `.strict()`).
    - [ ] H2.4b кросс-инварианты (`clock` требует якорь; `lower` переворачивает порядок целей) в domain-service + синхрон `api-contracts`.
  - **H2·5 (frontend)** — форма привычки + карточка:
    - [ ] H2.5a тайм-пикер целевого времени в форме привычки (при `kind='clock'`); ввод факта = фактическое время.
    - [ ] H2.5b формат минуты→HH:MM в отображении; инвертированный копирайт фидбэка («сдвигаем отбой раньше: 2:30», не «провалил»).
  - **H2·6 (verify):**
    - [ ] H2.6a `clock`-привычка «отбой ≤ 3:00»: серия «лёгких» → цель ползёт вниз (3:00→2:30) через полночь корректно.
    - [ ] H2.6b два недобора → мягкий откат вверх к `minTarget`; существующие `raise`-привычки не затронуты (регресс); `tsc`+`ng build` зелёные.
- **Оценка:** ≈ 4–5 сфокусированных чел.-дней (бэк ~1,5–2 / БД ~0,25 / API ~0,5 / фронт ~1–1,5 / verify+ADR ~0,5–1).

#### Трек C — «держусь» 🟢 Анти-привычки (`AntiHabit` + `Relapse`) — headline 2.6
_Заземлено на существующую доку: `domain-model §7`, `api-contracts §7`, `ui-ux` (экран `/accent/anti-habits`), `gamification §5`._
- **Бизнес (боль/ценность):** трекер «воздерживаюсь / не делаю X» (то, что цели и привычки не покрывают — там «делать больше», тут «не срываться»). Ценность: живой счётчик серии «сколько держусь» + история попыток + рекорд, который переживает срыв. Это headline-фича подфазы 2.6.
- **Система (спека, по факту доки):**
  - **Модель.** `AntiHabit` {`account_id`, `title`, `description?`, `isActive`, `currentAttemptStartedAt` (unix ms), `attemptNumber` (≥1), `recordDays`, `recordAttemptStartedAt?`, `targetDays?`}. `AntiHabitRelapse` {`anti_habit_id` FK, `relapseAt` (ms), `attemptDurationMs`, `triggerTag?`, `note?`, `created_at`}. Серия **не хранится** — вычисляется `floor((now − startedAt)/86_400_000)` (фронт в реальном времени).
  - **Домен.** Рецидив: `startedAt=now`, `attemptNumber++`, обновить `recordDays` если текущая серия > рекорда, записать `Relapse` (`attemptDurationMs` = длительность закрытой попытки). Серия — вычисляемая. **Concurrency:** рецидив под optimistic version/CAS (ADR-0035); гард `ALREADY_RELAPSED` (нельзя срыв без активной попытки / двойной срыв). PII-подсказка на `triggerTag`/`note`/`description` (ADR-0001, без реальных имён).
  - **API.** `GET /accent/anti-habits` (front считает `currentDays`) · `POST {title, description?, targetDays?}` · `GET/PATCH /:id` · `POST /:id/relapse {triggerTag?, note?}` → сброс/рекорд/история · `GET /:id/relapses?cursor` (пагинация). zod-DTO closed-shape; ошибка `ALREADY_RELAPSED`.
  - **Геймификация — НЕ в 2.6.** Очки/вехи серий (3/7/14/30) и события `anti_habit.held`/`anti_habit.relapsed` — это **2.9** (additive, anti-Skinner). 2.6 лишь **эмитит события-хуки** (слушателей нет до 2.9), баллы не считает; отложенные milestone-задачи (`@nestjs/schedule`, отмена при рецидиве) — тоже 2.9.
  - **Связь с состоянием (2.8):** сейчас фиксируем только `triggerTag`/`note` при срыве; богатая привязка к чек-ину/состоянию — в 2.8.
- **Человек (anti-burnout, из требований к 2.6 выше):** копирайт «Срыв» → «Новая попытка» (не «провал»); **рекорд и сумма переживают срыв** (модель это уже позволяет — рекорд отдельно от текущей серии); после срыва — короткая цель на возврат импульса; захват триггера без стыда; никакой аналитики залипания.
- **Нарезка (B/S/A/verify) — resumable подпункты:**
  - **2.6·C1 (docs)** — досверка спеки (файл-эталон готовой спеки: `domain-model §5–7`):
    - [x] C1.1 `domain-model §7`: поля подтверждены + добавлен явный инвариант «серия НЕ хранится (вычисляется), `recordDays` отдельно, **переживает срыв**». ✅ 2026-07-06.
    - [x] C1.2 `api-contracts §7`: 5 эндпоинтов на месте; добавлены `ALREADY_RELAPSED (409)` + явная cursor-пагинация `relapses`. ✅ 2026-07-06.
    - [x] C1.3 concurrency рецидива: зафиксирован optimistic `version`/CAS ([ADR-0035](../decisions/0035-concurrency-control.md)) в `domain-model §7`. ✅ 2026-07-06.
    - [x] C1.4 событие-хуки `anti_habit.held`/`anti_habit.relapsed` — уже в `gamification §7`; продублировано в `domain-model §7` (2.6 эмитит, слушатели в 2.9). ✅ 2026-07-06.
    - [x] C1.5 PII-подсказка на `triggerTag`/`note`/`description` — уже в `ui-ux §9` («причина срыва»); явно связано из `domain-model §7`. ✅ 2026-07-06.
  - **2.6·C2 (БД) ✅ ЗАКРЫТ** (миграция `0026` накатана на dev + структура сверена в БД) — эталон: `nest/src/database/schemas/habits.schema.ts`, `repositories/accent/accent-habit.repository.ts`:
    - [x] C2.1 `schemas/anti-habits.schema.ts` ✅ — поля §7 + PK `uuidv7___unixmillis` (varchar(52)), `version`, `created/updated_at`; времена попытки/рекорда = unix ms в `bigint` (шлём на фронт для живого счёта серии + арифметика); CHECK'и attempt≥1 / record≥0 / target>0 (защита-в-глубину).
    - [x] C2.2 `schemas/anti-habit-relapses.schema.ts` ✅ — FK `anti_habit_id` `ON DELETE CASCADE` + `relapse_at`/`attempt_duration_ms` (`bigint` ms) + `trigger_tag` varchar(120)/`note` text (свободные, «без ПДн») + `created_at`; индекс `(anti_habit_id, relapse_at)` под keyset-историю.
    - [x] C2.3 обе схемы зарегистрированы в `schemas/index.ts` ✅.
    - [x] C2.4 `db:generate` → `drizzle/0026_military_black_queen.sql` (2 таблицы, аддитивно) просмотрен глазами → `db:migrate` на dev ✅; `\d` обеих таблиц сверён (колонки/типы/CHECK/оба FK cascade/индекс на месте). tsc чист, nest-watch перезапустился без крэша.
    - [x] C2.5 репозитории ✅ — `accent-anti-habit.repository.ts` (list/find/create/update + `setAttemptCas` под version, ADR-0035) + `accent-anti-habit-relapse.repository.ts` (insert + `listRelapses` keyset-курсор по `(relapse_at,id)` desc). Порты `adapters/accent-anti-habit{,-relapse}-repository.port.ts` + интерфейсы `interfaces/anti-habit{,-relapse}-full.interface.ts` подтянуты вперёд (нужны схеме+репо для типов; это C3.1/C3.2 частично).
  - **2.6·C3 (домен+API) ✅ ЗАКРЫТ** (live-verified 31/31 на dev) — эталон: слайс `modules/accent/goals/` (свежий полный):
    - [x] C3.1 порты ✅ (сделаны в C2) — `adapters/accent-anti-habit-repository.port.ts` + `accent-anti-habit-relapse-repository.port.ts` (интерфейсы + DI-токены `ACCENT_ANTI_HABIT_REPOSITORY`/`…_RELAPSE_REPOSITORY`; чистая граница, без drizzle-типов).
    - [x] C3.2 интерфейсы ✅ — Full (C2) + views `anti-habit-view.interface.ts` (`AntiHabitView`+`toAntiHabitView`: времена как unix ms для живого счёта на фронте + снимок `currentDays` на `now`) и `anti-habit-relapse-view.interface.ts` (`AntiHabitRelapseView` + `AntiHabitRelapsePage {items, nextCursor}`).
    - [x] C3.3 DTO ✅ — `create-anti-habit.dto.ts` `{title, description?, targetDays?}`, `update-anti-habit.dto.ts` (все опц. + `isActive`), `relapse.dto.ts` `{triggerTag?, note?}` — zod `.strict()`, лимиты дублируют домен.
    - [x] C3.4 domain-service ✅ — `accent-anti-habit.domain-service.ts`: create/update/relapse/listRelapses. **Рецидив CAS-first (ADR-0035):** сброс попытки под `version` → только при успехе запись рецидива (конкурентный edit → retry по свежей version; конкурентный срыв/неактивна → `ALREADY_RELAPSED`; без «висячего» рецидива); `recordDays` обновляется если серия > рекорда; эмит `relapsed`. Серию считает фронт из `currentAttemptStartedAt`; сервер считает её лишь в момент срыва (для рекорда).
    - [x] C3.5 use-cases ✅ — все 6 (create/list/get/update/relapse/list-relapses) + курсор-утилита `relapse-cursor.util.ts` (base64url keyset). `relapse` возвращает `{antiHabit, relapse}` (фронт обновит карточку+историю без перезапроса); `list-relapses` — cursor-страница `{items, nextCursor}` (тянет `limit+1` для признака следующей). tsc чист.
    - [x] C3.6 контроллер ✅ — `controllers/anti-habits.controller.ts`: 6 маршрутов (list/create/get/patch/relapse/relapses) под `AuthGuard`, скоуп по аккаунту из Guard; ownership проверяет domain-service.
    - [x] C3.7 события ✅ — исходящий порт `accent-anti-habit-events.port.ts` (`relapsed`/`held`) + логирующий адаптер `logging-anti-habit-events.adapter.ts` (2.6 эмитит `relapsed`, слушателей нет; 2.9 подменит реализацию). Чистая граница вместо жёсткой event-шины.
    - [x] C3.8 модуль ✅ — `anti-habits.module.ts` (composition root: bind обоих портов↔Drizzle-репо + `ACCENT_ANTI_HABIT_EVENTS`↔логирующий адаптер + domain-service + 6 use-cases + controller; import `AccessControlModule`) + подключён в зонтик `accent.module`.
    - [x] C3.9 ошибки ✅ — `anti-habit-not-found.error.ts` (404) + `already-relapsed.error.ts` (409) в `shared/errors/`; маппинг в HTTP — через глобальный `all-exceptions.filter` (по `DomainError.httpStatus`, регистрация не нужна).
    - **✅ C3 ЗАКРЫТ И LIVE-VERIFIED (смоук 31/31, dev):** tsc 0 · boot: 6 маршрутов смапились + `Nest application successfully started` + DI ок · API-смоук на dev (h1verify): CRUD, 401/404/400 (strict+инварианты), рекорд **пережил срыв** (состарил старт на 3 дня → `recordDays=3` после рецидива, сброс попытки→attempt#2/currentDays=0), `ALREADY_RELAPSED` (неактивная + **гонка CAS**: burst 5 → 3×201+2×409, без 5xx), cursor-пагинация (desc, nextCursor, keyset), FK **CASCADE** (0 осиротевших рецидивов), dev подчищен. `api-contracts §7` синхронизирован под факт (response-формы).
  - **2.6·C4 (фронт)** — эталон: `angular/src/app/features/accent/habits/` и таймер микро-побед:
    - [x] C4.1 роут+навигация ✅ — lazy-route `/accent/anti-habits` (список) в `accent.routes.ts` + вкладка «Держусь» в `accent.component`. Роут детали `anti-habits/:id` — добавится в C4.5 (когда появится компонент). tsc чист.
    - [x] C4.2 API+типы ✅ — по факту НЕ отдельный `anti-habits.service.ts`, а методы в **центральном** `AccentApiService` (как habits/goals/micro-wins — единообразие; отдельные per-feature сервисы в проекте не приняты, [[flexible-plan-gaps-normal]]): 6 вызовов (list/get/create/update/relapse/listRelapses); Signals — в компонентах. Типы в `accent.types.ts`: `AntiHabitView`/`AntiHabitPayload`/`AntiHabitUpdatePayload`/`AntiHabitRelapseView`/`RelapsePayload`/`RelapseResult`/`AntiHabitRelapsePage`.
    - [x] C4.3 список-компонент ✅ — `anti-habits.component.ts`: карточки с **живым тик-счётчиком** серии (1 сек, из `currentAttemptStartedAt`), рекорд/цель/№попытки, клик по карточке → деталь (`routerLink`), «+добавить», пустое состояние, меню «⋯» (Изменить/Убрать из списка=`isActive:false`). Общий формат-util `anti-habit-format.util.ts` (серия дд:чч:мм:сс, склонения, компактная длительность). tsc чист.
    - [x] C4.4 форма create/edit ✅ — `anti-habit-form-modal.component.ts` (`title`/`description`/`targetDays` через чекбокс+`app-number-field`) в `MatDialog` на каркасе `.dlg`; паттерн «форма сама зовёт API, закрывается при успехе, ошибка внутри» (H#B2-9); PII-подсказка на свободных полях (ui-ux §9). tsc чист.
    - [x] C4.5 деталь ✅ — `anti-habit-detail.component.ts`: **живой счёт-вверх** (тик 1 сек, `setInterval`+очистка в `ngOnDestroy`) — большие «дни» в центре SVG-**кольца** + чч:мм:сс под ним; кольцо заполняется к `targetDays` (computed `ringOffset`). Рекорд/цель/№попытки. Роут `anti-habits/:id` подключён. tsc чист.
    - [x] C4.6 «Сорвался» ✅ — модалка `anti-habit-relapse-modal.component.ts` (подтверждение + `triggerTag`/`note`, PII-подсказка) → `relapseAntiHabit` → обновляет `item` (сброс счётчика, новый рекорд/№попытки) **и** префиксует историю без перезагрузки ([[spa-no-reload-reactivity]]); ошибка (409 и пр.) — через `ModalService.error`.
    - [x] C4.7 история попыток ✅ — cursor-пагинация в детали: первая страница на init, «Показать ещё» по `nextCursor` (keyset); карточки «продержался N · дата · триггер · заметка».
    - [x] C4.8 копирайт non-punitive ✅ — заголовок модалки срыва «Новая попытка», кнопка «Сорвался — начать заново», лид «срыв — данные, не приговор; рекорд останется с тобой»; рекорд всегда на виду (карточка+деталь); why-блок списка и пустые состояния в том же тоне (ADR-0049, [[accent-sustainable-achievement-design]], [[ui-copy-plain-simple]]).
  - **2.6·C5 (verify)** — live-смоук на **локальном dev-стеке** (поднят через `make` в корне проекта: браузер `localhost:4200` ↔ nest `localhost:3000`; НЕ прод/VDS):
    - [x] C5.1 ✅ (Playwright, dev localhost:4200) — создан держусь `targetDays=7`; счётчик серии **тикает** в списке (00:00:00→00:00:01) и на детали (часы 00:00:01→00:00:02); кольцо есть, дуга отрисована (цель 7 в мете).
    - [x] C5.2 ✅ — срыв → счётчик сброшен (0 дней), `попытка №2`, запись в истории с триггером «e2e-скука». **Рекорд переживает срыв:** состарил старт на 3 дня (psql) → на детали 3 дня → повторный срыв → `рекорд: 3 дня`, `попытка №3`, история «продержался 3 дня» (2 записи).
    - [x] C5.3 ✅ (косвенно) — `ALREADY_RELAPSED` покрыт API-смоуком C3 (гонка 5→3×201+2×409); UI лишь показывает `ModalService.error` при 409 (последовательные срывы в UI легитимно успешны).
    - [x] C5.4 ✅ — история рендерится/подгружается тем же keyset-путём, что API-verified в C3 («Показать ещё» появляется при >30 записей); `tsc` + `ng build` (prod) зелёные. **Замечание (не баг):** на boot один `401 POST /auth/refresh` (нет refresh-cookie до логина) — штатное поведение ЛК, не из «Держусь».
  - **✅✅ ТРЕК C «держусь» (2.6.0) ЗАКРЫТ ПО КОДУ И ВЕРИФИЦИРОВАН** (C1 дока · C2 БД+миграция 0026 · C3 домен+API live 31/31 · C4 фронт · C5 браузер live 19/19). Готов к деплою бандлом `2.6.0` (бамп `VERSION` + prod-migrate 0026 при выкатке). Не задеплоено (по решению — деплой отдельно).
- **Оценка Трека C:** ≈ 3 сфокусированных чел.-дня (2 таблицы + свой домен/таймер; геймификация вынесена в 2.9).

#### Порядок релизов 2.6.x (рекомендация; треки независимы — можно менять)
Зависимостей по коду нет, поэтому порядок — по риску/ценности, а не по необходимости:
1. **`2.6.0` — Трек C «держусь»** (headline подфазы; своя изолированная модель, средний риск).
2. **`2.6.1` — Трек A / FEAT-H1** (фронт-only, быстрый, низкий риск; после C или параллельно).
3. **`2.6.2` — Трек B / FEAT-H2** (трогает ядро `LadderEngine` — самый рисковый, делать последним и с ADR).
> Общий UX-язык anti-burnout (non-punitive, «сдвигаем, не проваливаем», рекорд ≠ обнуление) проектируется один раз и переиспользуется в B (фидбэк понижающейся лесенки) и C (экран срыва). Итого 2.6 ≈ **10–12 чел.-дней** (C ~3 + A ~1–1,5 + B ~4–5 + общий UX/склейка ~1–2).
> **⚠️ Ренумерация 2.6.x (Elmir 2026-07-24):** Трек A / FEAT-H1 фактически уехал в прод как `2.5.4/2.5.5` (не 2.6.1); номера `2.6.1`/`2.6.2` **переотданы** под доработки «держусь» (блок ниже). Трек B / FEAT-H2 — отдельный небольшой деплой (номер уточнить: остаток 2.5.x или в общий бандл). Финальную схему нумерации утверждает Elmir при деплое.

#### 2.6.1 / 2.6.2 — доработки «держусь» (backlog, из догфудинга Elmir 2026-07-24)
> Источник вдохновения — сторонние трекеры (напр. «Bad Habit Break»): берём **только идеи**,
> модель/доку пишем с нуля под наш scope (CLAUDE.md §4). Сперва **дока+ADR** по пунктам 2/3/6
> (меняют модель), потом код. Пункты 4/5 — мелкие UI, можно сразу. Разбить на `2.6.1`+`2.6.2`.
- [ ] **D1. Стартовый пак «держусь»** (пример-витрина, ADR-0051 inert-showcase как у micro-wins/habits/goals): колонка `anti_habits.is_starter` + `STARTER_ANTI_HABITS` (не курю / не пью / не залипаю в ленту / бегаю-регулярно / без сахара / без порно / … — адекватный широкий набор) + endpoints starter-pack/clear/adopt + бейдж «пример» + CTA. **Средне** (устоявшийся паттерн).
- [ ] **D2. Старт-дата при создании (прошлое/будущее) + правка даты через деталь → в историю.** Чекбокс «Начать не сегодня» ТОЛЬКО при создании: старт в прошлом (бэкфилл уже идущей серии) или в будущем (планирование — «планирую начать через N дней», серия ещё не идёт, состояние `planned`). В **редактировании** даты нет — сдвиг только с экрана детали, и он **логируется в историю** как событие-корректировка: «с ДАТЫ по ДАТУ продержался N дней» / если будущее — «планирую начать через N дней». **Требует дизайна:** новое состояние `planned`, новый ТИП события истории (не рецидив, а корректировка) → схема `anti_habit_relapses` обобщается в «события таймлайна» (тип: relapse | adjust | plan) ИЛИ отд. таблица. **Тяжело, нужен ADR.**
- [ ] **D3. Авто-эскалация цели (как Bad Habit Break).** Цель не фиксирована, а «горит» следующим порогом: создал → серия 0, цель 1 день → 3 → 5 → 7 → 14 → 21 → 30 → … По достижении порога цель авто-двигается к следующему. Если юзер задал свою (напр. 7) — дальше авто-двигается ОТ неё (14/21/30/…). **Требует дизайна:** лестница порогов + взаимодействие с ручной целью → `targetDays` становится вычисляемым «следующим порогом». **Средне-тяжело, ADR.**
- [ ] **D4. Акцент на «Рекорд» и «Попытка N»** — жирный шрифт/визуальный вес (сейчас теряются). **Мелко, UI-only.**
- [ ] **D5. Переименовать кнопку «Сорвался — начать заново» → «Рецидив»** + добавить действие «Начать в будущем»/«Переместить» (связано с D2). **Мелко** (переименование) + зависит от D2 (кнопка переноса).
- [ ] **D6. Drag-reorder «держусь»** (как micro-wins/goals/habits, ADR-0054): колонка `anti_habits.position` + reorder-endpoint + drag-UI. **Средне** (устоявшийся паттерн).
> **Форки — решения Elmir 2026-07-24:**
> - **(а) D2 старт в прошлом — НЕТ.** Правку идущей серии в прошлое не даём (бэкфилл → «проще создать новую + удалить старую»). Механика только **в будущее**: при создании чекбокс «Начать не сегодня» → плановый старт (состояние `planned`, серия ещё не идёт); из карточки идущей серии — «Перенести на будущее» (текущая попытка завершается/сбрасывается, старт уходит в будущее). Всё логируется в историю.
> - **(б) D2 модель истории — РЕШАЮ (best-practice, ждёт ok):** «держусь» НЕ задеплоен → **свободно пересобираем схему**. Заменяем relapse-only `anti_habit_relapses` на единый **таймлайн событий** `anti_habit_events` (`type`: `relapse | reschedule | plan | goal_reached`, `occurred_at` + типо-специфичные поля/`payload`). Обоснование: история = смешанная лента (срыв + перенос + план + «цель достигнута» из D3) — это ровно activity-feed паттерн; тип-дискриминатор чище, чем перегрузка relapse-таблицы или россыпь таблиц. Т.к. прод-данных нет — миграция без боли (пере-генерим 0026 или добавим 0027 до деплоя).
> - **(в) D3 лестница — КАЛЕНДАРНО-ЗАВИСИМАЯ, цель = ДАТА (не просто дни):** 1 · 3 · 5 · 7 («неделя») · 14 (2 нед) · 21 (3 нед) · **1 месяц** (зеркальное число в след. месяце, с клампом к концу месяца если числа нет: старт 31-го → конец след. месяца) · 40 дн · 50 дн · **2 месяца** · **3 месяца** (~90) · **полгода** · **три квартала** (9 мес) · **год**. После года — «морковка перед осликом»: текущая дата + 7 дней; по достижении → в историю событие `goal_reached` + авто-сдвиг цели ещё на +7 дней. Порог месяц/квартал/год = дата = старт + N календарных месяцев (кламп к концу месяца); порог N дней = старт + N дней. Движок берёт ближайшую будущую пороговую ДАТУ. Каждое достижение порога → событие `goal_reached` в истории.
> - **(г) разбивка (я решаю): `2.6.1` = D1 (стартер-пак) + D4 (акцент рекорд/попытка) + D5-переим. («Рецидив») + D6 (drag-reorder)** — быстрые/паттерновые, видимая польза; **`2.6.2` = D2 (план/перенос + таблица событий) + D3 (авто-эскалация календарной цели) + D5-кнопка переноса** — дизайн-ядро, один ADR на модель событий+лестницу.
> **Уточнения Elmir 2026-07-24 (2):**
> - **D7 (new) — пасхалка «машина времени».** На карточке идущего «держусь» — персонаж со знаком «?» и текстом типа «Хочешь перенестись в прошлое?»; при наведении тултип: «Машины времени, чтобы перенестись в прошлое, не существует — создай новую, а эту удали». Шуточный анти-фича-объяснитель (почему нельзя бэкфилл в прошлое) вместо сухого запрета. Тон — [[ui-copy-plain-simple]] + характер бренда.
> - **D1 стартер-пак — ПОСЛЕДНИМ** (после D2/D3/…): примеры должны соответствовать НОВЫМ механикам (авто-цель/перенос), иначе придётся переделывать. → порядок сборки: D4/D5-переим/D6 → D2 → D3 → D7 → **D1 в конце**.
> - **Деплой: НЕ инкрементально.** 2.6 НЕ выкатываем, пока не готово ВСЁ (вкл. стартер-пак под новые механики). Бандл-деплой один раз → **прод не увидит relapse-only схему**: таблицу событий фолдим в базу ДО первого деплоя (перегенерить `0026` или добавить `0027`; «Трек C 2.6.0» база **переработается** — relapse→events, +`planned`, +авто-цель — не шиппится как есть). Номер VERSION — один бамп при бандл-деплое (2.6.x, уточнит Elmir).
> - **Feature-file (красочный).** Нужен `md`-файл фичи под 2.6.N (как release-*.md, но живо/красочно): что такое «держусь», зачем, механики (серия/рекорд/рецидив/авто-цель/перенос/пасхалка) — человеческим языком. Писать по мере готовности механик (дока = факт: готово → настоящее время).
> **Порядок работ 2.6.1/2.6.2 (методология: сперва дока+ADR, потом код, инкрементально с отметками в плане):** (1) ✅ **ADR написаны** — [ADR-0059](./decisions/0059-anti-habit-timeline-events.md) (модель событий `anti_habit_events`) + [ADR-0060](./decisions/0060-anti-habit-calendar-goal-ladder.md) (календарная лестница целей); (2) ✅ **синхрон доки сделан** — `domain-model §7` (события/planned/перенос/авто-цель, статусы реализовано/план) + `api-contracts §7` (эндпоинты `/reschedule`, `/events`, `nextGoal`/`state`, `startAt`, `INVALID_START_DATE`; помечено 📋 = план); (3) код (нарезан мелко ниже) ← **следующий шаг**; (4) feature-file; (5) live-verify; (6) бандл-деплой.

**Нарезка кода 2.6.1/2.6.2 на под-шаги** (каждый = один слой/концерн, коммит+отметка на шаг; глубокую детализацию блока уточняем при его старте — как делали с C2/C3/C4). Логическая группировка (деплой всё равно один бандл): **2.6.1 = быстрые UI/паттерн (D4/D5-переим/D6); 2.6.2 = модель-ядро + закрывающие (D2/D3/D7/D5-кнопка/D1)**.
- **D4 — акцент рекорд/попытка (UI):** [x] D4.1 ✅ жирный/вес «Рекорд»+«Попытка N» в карточке списка и детали (`.ah__stat`/`.ah__num`/`.ahd__stat`/`.ahd__num`: значение — акцентный жирный, подпись — обычный текст вместо muted). tsc чист.
- **D5 — «Рецидив» (UI):** [x] D5.1 ✅ кнопка детали «Сорвался — начать заново» → **«Рецидив»** (модалка внутри осталась тёплой «Новая попытка» — non-punitive). tsc чист. _(D5.2 кнопка «Перенести в будущее» — идёт в D2.)_
- **D6 — drag-reorder (ADR-0054):** ✅ ЗАКРЫТ. [x] D6.1 БД `anti_habits.position` (миграция `0027` накатана на dev, колонка есть); [x] D6.2 бэк (repo.reorder UPDATE FROM VALUES + create position=max+1 + list order by position; domain.reorder; `ReorderAntiHabitsUseCase`; `PUT /anti-habits/reorder {ids}` до `:id`; порт+DTO); [x] D6.3 фронт (CDK drag+handle в списке, `reorderAntiHabits`, оптимистично+откат); [x] D6.4 verify (tsc+ng-tsc чист; boot ок; API-смоук: create A,B,C → reorder → C,A,B, 204). Браузерный drag-клик — в финальном verify.
- **D2 — события + planned + перенос (ADR-0059; рефактор базы до деплоя; стратегия expand-contract — события добавлены рядом с relapses, консюмеры переводятся, потом relapses дропаем):** [x] D2.1 ✅ БД `anti_habit_events` (type + типизир. nullable-колонки + индекс `(anti_habit_id, occurred_at)`; интерфейс `AntiHabitEventFull`+`ANTI_HABIT_EVENT_TYPES`; миграция `0028` накатана; relapses пока рядом); [x] D2.2 ✅ порт+репо событий (`ACCENT_ANTI_HABIT_EVENT_REPOSITORY`; `insert`+`listEvents` keyset; забинден в модуле; tsc+boot ок); [x] D2.3 ✅ домен (relapse пишет событие `relapse`; `reschedule` под CAS c heldDays + рекорд; создание `startAt`→`plan`+planned; `planned` вычисляемо в view; `INVALID_START_DATE`; listRelapses→listEvents); [x] D2.4 ✅ API (`POST /reschedule`, `/relapses`→`GET /events`, `AntiHabitEventView`+`AntiHabitEventPage`, `state` в `AntiHabitView`, `startAt` в create-DTO; use-cases relapse→{antiHabit,event}, reschedule, list-events; event-cursor util; старые relapse-use-case/cursor удалены). **API-смоук 10/10** (planned state + событие plan; create/reschedule startAt в прошлом → 400; relapse→event type=relapse/attempt#2; reschedule→event type=reschedule/planned; events=2). tsc+boot ок. [x] D2.5 ✅ фронт (типы `AntiHabitEventView`/`state`/`ReschedulePayload`; сервис `/relapses`→`listAntiHabitEvents`+`rescheduleAntiHabit`; **деталь**: история по типу события `eventTitle` (relapse/reschedule/plan/goal_reached), planned-баннер «старт через X», кнопка «Перенести в будущее»→модалка `anti-habit-reschedule-modal` (date→startAt)→relapse-подобное обновление без перезагрузки; **список**: planned-карточка «🗓 старт DD.MMM»; **форма**: чекбокс «Начать не сегодня»+date→`startAt` (только при создании; в edit не шлём). ng-tsc + prod-build зелёные). [x] D2.6 ✅ **дроп relapses** (удалены схема/репо/порт/full+view интерфейсы relapse; миграция `0029` DROP TABLE CASCADE накатана; `AntiHabitRelapsedEvent` эмит-хук и модалка «Рецидив» — оставлены, это не таблица) + **браузер-verify 6/6** (Playwright dev: planned-карточка «🗓 старт», баннер «Старт запланирован», событие «Рецидив» в истории, перенос→planned + событие «Перенос старта», без ошибок консоли). tsc+boot ок. **✅ ВЕСЬ D2 ЗАКРЫТ.**
- **D3 — авто-эскалация календарной цели (ADR-0060):** [x] D3.1 ✅ util `anti-habit-goal-ladder.util.ts` — `addMonthsClamp` (зеркальное число, кламп к концу месяца) + `nextGoal(startedAt, now, manualTargetDays?)` → `{label, thresholdDays, targetDate}` (лестница 1/3/5/7/14/21/месяц/40/50/2мес/3мес/полгода/3квартала/год → +7д морковка ∞; ручная цель = пол-ступень). Чистые ф-ции; спот-верифай: 31.03→30.04, 31.01→28.02, високос 2028→29.02, перенос года ок; tsc чист. [x] D3.2 ✅: `nextGoal {label,thresholdDays,targetDate}` в `AntiHabitView` (вычисляется на чтение через util; фронт-тип синхронизирован) + util `reachedGoals` + **ленивая материализация `goal_reached` в domain `listEvents`** (первая страница, курсор пуст): repo/port `latestGoalReachedThreshold(antiHabitId, sinceOccurredAt)` (max thresholdDays среди `goal_reached` с occurredAt ≥ старт текущей попытки — граница попытки) → domain зовёт `reachedGoals(started, now, targetDays, since)` и пишет `goal_reached` (occurredAt=targetDate) идемпотентно (since фильтрует уже отмеченные). **Миграция НЕ нужна** (поля событий есть). Live-verify (dev, h1verify): 8-дн серия→1/3/5/7; повторный GET без дублей; чистая новая попытка (4 дн)→1/3; nest tsc чист. [x] D3.3 ✅ фронт: кольцо детали считает долю от старта попытки до `nextGoal.targetDate` (дуга рендерится всегда), подпись цели под кольцом (`nextGoal.label` + дата) с иконкой 🥕 в фазе «морковки» (label `год + N дн`)/🎯 иначе; список — та же подпись цели в карточке; `goal_reached` в истории (уже с D2.5); убран raw-`targetDays`. prod-build+tsc зелёные. [~] D3.4 verify: **API-верифай пройден** (dev, h1verify — свежая→«1 день»; 10 дн→«2 недели» + история 1/3/5/7 + кольцо ~10/14; >1 года→«год + 7 дн» 🥕 + полная лестница; список 🎯/🥕) + prod-build. **Браузерный Playwright-клик — в финальном live-verify** (в этой сессии playwright-тулинга нет).
- **D7 — пасхалка «машина времени» (UI):** [x] D7.1 ✅ на карточке идущего (не planned) «держусь» — персонаж `🕰️❓` + тизер «Хочешь перенестись в прошлое?»; на hover/focus тултип-панчлайн («…машины времени не существует — создай новую, а эту удали 🙂»). Добавлен общий вариант `.tooltip-host--wrap` (перенос строк + max-width 240px) для длинных подсказок. prod-build зелёный.
- **D1 — стартер-пак «держусь» ПОСЛЕДНИМ (ADR-0051 инертная витрина):** [x] D1.1 ✅ БД `anti_habits.is_starter` (bool default false) + `AntiHabitFull`/`View` + миграция `0030` (накатана на dev). [x] D1.2 ✅ бэк: `STARTER_ANTI_HABITS` (6 «лент/залипаний» под ядро-отказ) + repo `createMany`/`deleteStarters`/`create(isStarter)` + domain `seedStarterPack` (идемпотентно, дедуп по названию) / `clearStarters` (только непринятые) / `adopt` (снимает флаг + серия с нуля) + adoption правкой + **инертность** (relapse/reschedule на примере → 400 «сначала Добавить себе»; `goal_reached` не материализуется) + endpoints `POST`/`DELETE /anti-habits/starter-pack`, `POST /anti-habits/:id/adopt` (до `:id`) + 3 use-case + модуль. Live-verify: seed 6/идемпотент, relapse/reschedule→400, events без goal_reached, adopt→серия 0+relapse 201, clear чистит только непринятые. [x] D1.3 ✅ фронт: CTA «Получить пак»/«Очистить примеры» (шапка + empty-state) + хинт; карточка примера — бейдж «пример» + описание-витрина (без счётчика/цели/пасхалки) + «Добавить себе»; деталь — бейдж + скрыты рецидив/перенос/подпись цели, вместо них adopt + пояснение; api-сервис seed/clear/adopt + `isStarter` в типе. prod-build+tsc зелёные. [x] D1.4 ✅ verify: API-смоук **5/5** (seed 6 + view-форма для фронта + adopt + edit-adoption + clear) + prod-build; dev подчищена. **✅ ВЕСЬ D1 ЗАКРЫТ.**
- **Закрытие:** [x] feature-file ✅ [`docs/feature-derzhus.md`](./feature-derzhus.md) (красочный черновик релиз-ноты; версия — при деплое); [x] синхрон доки ✅ (domain-model §7 `is_starter`/инертность; api-contracts §7 переписан на факт: `state`/`isStarter`/`nextGoal`, starter-pack/adopt, материализация goal_reached, 📋→факт); [ ] **финальный live-verify (браузер, все механики) — за Elmir** (в этой сессии playwright-тулинга нет; бэк API-verified пошагово); [ ] **бандл-деплой — за Elmir** (VERSION-бамп один раз + prod-migrate 0028/0029/0030 + бродкаст из feature-file; номер версии утверждает Elmir).
> Итого ≈ **22 под-шага** (не 7 плоских D). Каждый шипается в план отдельной галочкой; порядок внутри блока можно менять, если всплывёт зависимость.

### 2.6–2.12 — скелет (детальные шаги — при старте подфазы)
> **⚠️ ПРАВИЛО НАРЕЗКИ (Elmir 2026-06-18) для 2.5+/2.6+/3+:** при детализации каждой подфазы
> подключать **аналитическую линзу из 3 шляп** (как скилл/проход, при нужде — субагент):
> **бизнес-аналитик** (ценность/боль/для кого/приоритет) + **системный аналитик** (спека/модели/
> контракты/edge/нефункц.) + **эксперт по помощи людям** (психология, реальная польза, anti-burnout,
> тон «интерес-не-страх»). Не только тех-корректность. Это часть нарезки, а не опция.
- **2.2 микро-победы:** ✅ детализировано выше (2.2·1–·7).
- **2.3 стартовый набор (отличимость + adoption):** ✅ детализировано выше (2.3·1–·6), дизайн согласован.
- **2.4 привычки + задачи + лесенка:** ✅ детализировано выше (2.4·1–·21, вкл. ретро-обзор ·21), решения зафиксированы.
- **2.5 цели:** БД `goals`(+`parent_goal_id`)/`goal_entries`/`milestones` + env `ACCENT_GOAL_MAX_DEPTH` → домен (forecast/rollup/инвариант глубины)+API → фронт `/accent/goals` (+подцели).
- **2.6 держусь:** ✅ детально нарезано выше (блок «🧩 2.6 — детальная нарезка», 3 трека A/B/C, релизы `2.6.x`). Ядро (Трек C): БД `anti_habits`/`anti_habit_relapses` → домен+API → фронт `/accent/anti-habits` (живой счёт-вверх); + Трек A (таймер `timed`-привычек) + Трек B (полярность лесенки + `clock`). Треки независимы.
  - **💡 Требования к дизайну (anti-burnout, зафиксировано 2026-07-06):** (1) метрика — **годовой тренд / накопленная сумма, а не идеальная цепочка**; рекорд и сумма НЕ обнуляются одним срывом (иначе UI усиливает ловушку «порвалось = всё пропало»); (2) **non-punitive:** срыв = событие-рецидив в журнале, не сброс в ноль; после срыва — короткая цель на возврат импульса (напр. 7 дней) вместо прежней большой планки; (3) срывы кластеризуются на пике стресса/недосыпа → анти-привычка должна уметь ссылаться на состояние/чек-ин (**2.8**), рычаг — стресс и сон, не «сила воли».
- **2.7 препятствия:** БД `obstacles`/`counterplays` → домен+API → фронт `/accent/obstacles`.
- **2.8 состояние:** БД `check_ins`/`daily_lessons` → `StateResolver`(упрощённый)+`Recommender`+тренды+API → фронт `/accent/checkin` + «Сейчас» на дашборде. **+ напоминания через центр уведомлений** (Recommender генерит серверные ноты «не отмечал прогресс N дней / срок вехи» в существующий центр — без push/облаков, self-host).
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
- **Аналитическая линза = 3 шляпы** (Elmir 2026-06-18, опора на коммерч. опыт в IT) — при нарезке
  КАЖДОЙ подфазы (2.5+/2.6+/3+) прогонять фичу через: **(1) бизнес-аналитик** — какую боль решает,
  для кого, ценность, приоритет, нужна ли вообще; **(2) системный аналитик** — требования→спека,
  модели данных/контракты, консистентность, edge-кейсы, нефункц. (идемпотентность/безопасность/
  производительность); **(3) эксперт по помощи людям** — психологическая обоснованность, реальная
  польза, anti-burnout, тон «интерес-не-страх». Не только тех-корректность. При нужде — субагент.
- **Регулярное ретро (как в скраме)** (Elmir 2026-06-18) — после каждой подфазы / крупной вехи
  обзор глазами того же аналитика: что могли не учесть для пользы человеку; находки → форки/
  задачи/патч. Первое формализованное — `2.4·22` (обзор всего пути 0.0→2.4).
- Дока отражает **намерение** (фазы 2 ещё нет в коде) — формулировки в будущем времени,
  статусы 📋/⬜; на настоящее переписываем по мере реализации (правило свежести, CLAUDE.md).
- Архитектура — та же, что фаза 1: 5-слойка, feature-first, Drizzle, id `uuidv7___unixmillis`,
  Signals + чистый SCSS, MatDialog. Кросс-домен только вниз.
- Реализацию (после вычитки) дробим под-волнами 2.0 → 2.1 (ADR-0027/todo) — детализируем здесь же.
