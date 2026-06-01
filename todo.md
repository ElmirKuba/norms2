# todo.md — план работ «Нормисы»

> Двигаемся по фазам. Каждый пункт — `- [ ]` пока не сделан, `- [x]` когда закрыт. Новые подзадачи дописываем в свою фазу.

---

## Фаза 0 — Документация и фундамент (в процессе)

- [x] Создать структуру `~/coding/norms2/{docs,Вдохновиться}/`
- [x] Скопировать вдохновение: `Вдохновиться/акцент/` и `Вдохновиться/новаскил/`
- [x] Написать `CLAUDE.md`
- [x] Написать `Technical-assignment.md`
- [x] Написать этот `todo.md`
- [x] Написать `docs/README.md` (карта документации)
- [x] Написать `docs/152fz.md` (ресёрч: как не попасть под 152-ФЗ, выводы для проекта)
- [x] Завести `docs/decisions/` (ADR-журнал) + ADR-0001 (минимизация ПДн)
- [x] Написать `docs/methodology.md` (метод рассуждения: CoT / ToT / Self-Consistency)
- [x] Построить `docs/decision-map.md` (карта всех точек решения по проекту)
- [x] **Пройти карту решений по шагам** — все развилки фазы 1 закрыты, по каждой заведён ADR (0001–0026). Карта сверена построчно и перенесена в `docs/archive/decision-map.md`.
- [ ] **Принять решение по VPS** — выбрать провайдера вне РФ (см. ниже §«Решения, которые нужно принять»)
- [ ] **Зарегистрировать backup-домен** в зоне `.com` / `.app` / `.io` (риск разделегирования `.рф`, см. `docs/152fz.md`)
- [ ] Зафиксировать решение по VPS в `docs/deployment.md`
- [x] Написать `docs/architecture.md` — слои, модули, потоки, сквозные механизмы (ADR-0019)
- [x] Написать `docs/domain-model.md` — Account, SecretQuestion, InviteCode, Invitation, Ban, Session (консолидировано из ADR)
- [x] Написать `docs/database.md` — 7 таблиц фазы 1, связи, политика миграций (консолидировано из ADR)
- [x] Написать `docs/api-contracts.md` — REST для auth/profile/invites/bans/sessions/recovery (ADR-0020)
- [x] Написать `docs/backend.md` — правила `./nest/`, конфиг/ошибки/логи/тесты (ADR-0019/0020/0021)
- [x] Написать `docs/frontend.md` — правила `./angular/`, Signals, HTTP-слой, auth (ADR-0020/0021)
- [x] Написать `docs/ui-ux.md` — дизайн-язык, токены, экраны фазы 1, тон (ADR-0025)
- [x] Написать `docs/deployment.md` — Docker, Traefik+LE, ENV, бэкапы, sweep (ADR-0023)
- [x] Написать `docs/getting-started.md` — docker-compose.dev, .env.example, локальный запуск (ADR-0021)

---

## Фаза 1 — Личный кабинет

### 1.1. Bootstrap

- [ ] Инициализировать `./nest/` (NestJS 10+, TypeScript strict)
- [ ] Инициализировать `./angular/` (Angular 17+, standalone, Signals, Tailwind)
- [ ] `docker-compose.dev.yml` — Postgres, nest, angular dev-server
- [ ] `.env.example` с `FREE_REGISTRATION`, `JWT_SECRET`, `DB_*`
- [ ] `.gitignore`, `.editorconfig`, ESLint, Prettier
- [ ] Базовая CI (lint + build) — отложить до момента, когда появится репозиторий на git-хостинге

### 1.2. Backend — модуль `auth`

- [ ] Доменные сущности: `User`, `Credentials`, `SecretQA`
- [ ] Use-case: `RegisterUser` (с поддержкой обоих режимов `FREE_REGISTRATION`)
- [ ] Use-case: `LoginUser`
- [ ] Use-case: `LogoutUser`
- [ ] Use-case: `RecoverPasswordViaSecretQA`
- [ ] Порты репозиториев (интерфейсы) в `application/`
- [ ] TypeORM-адаптеры в `infrastructure/`
- [ ] NestJS controllers + DTO + guards в `interface/`
- [ ] JWT-стратегия + refresh-механика
- [ ] Тесты на use-cases (unit)
- [ ] Интеграционные тесты на endpoint-ы

### 1.3. Backend — модуль `profile`

- [ ] Доменная сущность `Profile` (alias, public-view, self-view)
- [ ] Use-case: `GetMyProfile`
- [ ] Use-case: `GetUserProfileByLogin`
- [ ] Use-case: `UpdateMyAlias`
- [ ] Endpoints

### 1.4. Backend — модуль `invites`

- [ ] Доменная сущность `Invite` (code, reason, inviter, used_by, used_at)
- [ ] Use-case: `CreateInvite` (с обязательной причиной)
- [ ] Use-case: `ConsumeInvite` (вызывается из `RegisterUser`)
- [ ] Use-case: `ListMyInvites`
- [ ] Endpoints

### 1.5. Backend — модуль `bans`

- [ ] Доменная сущность `Ban` (banner, banned, reason, created_at)
- [ ] Проверка прав: банить можно только в своём поддереве приглашений
- [ ] Use-case: `BanUserInMyTree`
- [ ] Use-case: `UnbanUser`
- [ ] Use-case: `ListBansByMe`
- [ ] Guard: блокировать вход забаненным
- [ ] Endpoints

### 1.6. Frontend — feature `auth`

- [ ] Экран `register` (с условным полем кода приглашения)
- [ ] Экран `login`
- [ ] Экран `recover-password` (через секретный вопрос)
- [ ] Сервис `core/api/auth.service.ts`
- [ ] Storage refresh-токена + interceptor

### 1.7. Frontend — feature `profile`

- [ ] Экран `my-profile` (self-view)
- [ ] Экран `user-profile/:login` (public-view)
- [ ] Редактирование alias

### 1.8. Frontend — feature `invites`

- [ ] Экран `my-invites` (создать с причиной, посмотреть кого пригласил)
- [ ] Действие «забанить» в карточке приглашённого

### 1.9. Deploy (когда фаза 1 готова к боевому тесту)

- [ ] Купить VPS (см. решение в Фазе 0)
- [ ] Ubuntu 22.04 LTS, базовая настройка, SSH-ключи, firewall
- [ ] Установить Docker
- [ ] `docker-compose.prod.yml`
- [ ] Let's Encrypt через nginx или Traefik (решение зафиксировать в `docs/deployment.md`)
- [ ] Привязать `нормисы.рф` (но **домен в зоне `.рф` ≠ хостинг в РФ**, это норм — см. `docs/152fz.md`)
- [ ] Бэкапы Postgres (стратегия — в `docs/deployment.md`)

---

## Фаза 2 — Раздел «Акцент»

**Дока раздела готова** (синтезирована из вдохновения, источники переварены и удалены). Реализация — после закрытия Фазы 1.

- [x] Переварить источники вдохновения (Ascent + SuperBetter-спек) → копилка идей. История: `docs/archive/phase2-analysis-map.md`
- [x] Принять ключевые решения раздела — [`docs/decisions/0027-accent-phase2-core.md`](./docs/decisions/0027-accent-phase2-core.md)
- [x] Написать доку раздела — [`docs/sections/accent/`](./docs/sections/accent/README.md): README, domain-model, gamification, api-contracts, ui-ux
- [x] Развилки R6/R10 решены — [`docs/decisions/0028-accent-timezone-and-domains.md`](./docs/decisions/0028-accent-timezone-and-domains.md): timezone в `accounts`, цели = сфера + RPG-атрибуты
- [ ] Реализация (после Фазы 1): по под-волнам 2.0 → 2.1 (workout/соц/AI) — детализируем при старте

---

## Фаза 3 — Раздел «НоваСкил»

**Дока раздела готова** (LMS-курсы, синтезировано из протокола вдохновения). Реализация — после Фаз 1–2.

- [x] Переварить протокол НоваСкил → копилка. История: `docs/phase3-analysis-map.md`
- [x] Решения N1–N8 → [`docs/decisions/0029-novaskil-phase3-core.md`](./docs/decisions/0029-novaskil-phase3-core.md)
- [x] Дока раздела — [`docs/sections/novaskil/`](./docs/sections/novaskil/README.md): README, domain-model, content-format, api-contracts, ui-ux
- [x] Папка `Вдохновиться/` удалена (оба источника переварены 100%; бэкапы — в git-истории и `~/Downloads`)
- [ ] Реализация (после Фаз 1–2); связь курс↔Акцент (N6) и геймификация обучения (N5) — волнами

---

## Фаза 4 — Мессенджер «облачный»

Открыть после Фазы 3.

---

## Фаза 5 — Мессенджер e2e

Открыть после Фазы 4. Поднимать кодовую базу `~/coding/norms` как референс.

---

## Фаза 6 — Native (Capacitor + Electron)

Открыть после Фазы 5.

---

## Решения, которые нужно принять

Все решения фазы 1 приняты и зафиксированы как ADR — [`docs/decisions/`](./docs/decisions/README.md). Карта развилок (🗄 архив, фаза 0 завершена) — `docs/archive/decision-map.md`.

---

## Архив идей из переписки (чтоб не потерять)

Из сессии запуска проекта 2026-05-29:

- Домен `нормисы.рф` уже куплен — entry point остаётся; хостинг — вне РФ.
- В долгосрочной перспективе — мессенджер с двумя режимами: «облачный» (web-доступный, сервер видит ключи) и «e2e» (только нативные приложения, как было в `~/coding/norms`).
- Не хранить ФИО, паспорта, реальные email в обязательных полях; идентификация — `login` + `alias`-псевдоним.
- Регистрация по приглашениям, у каждого приглашения — обязательная причина; пригласитель может банить в своём поддереве.
- Восстановление пароля — через секретный вопрос/ответ.
