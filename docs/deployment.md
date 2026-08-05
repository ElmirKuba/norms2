# deployment.md — деплой и эксплуатация

> Рабочая инструкция по прод-деплою «Нормисов» (`нормисы.рф`) — **по факту**, как стек устроен сейчас. Архитектурные «почему» — [ADR-0023](./decisions/0023-deployment-jurisdiction.md) (юрисдикция), [ADR-0045](./decisions/0045-traefik-file-provider.md) (Traefik file-провайдер), [ADR-0044](./decisions/0044-versioning-strategy.md) (версия/commit), [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md) (миграции). Локальный запуск — [`getting-started.md`](./getting-started.md). ENV — также [`backend.md`](./backend.md).

---

## 1. Что задеплоено (факт)

- **Сервер:** Selectel VDS «Johanna», Ubuntu 24.04, 2 vCPU / 2 ГБ RAM + 4 ГБ swap, IP `139.100.225.195`. Доступ/секреты — в памяти Claude (`prod-vds-access`), не в репозитории.
- **Домен:** `нормисы.рф` (Timeweb DNS, A `@` → IP, TTL 600). В конфигах/ACME — **punycode** `xn--h1ahceki4e.xn--p1ai` (в DNS-панели показывается кириллицей).
- **Каталог деплоя:** `/home/norms2` — git-клон ветки `main` с `https://github.com/ElmirKuba/norms2.git`.
  Код зеркалится ещё на [Codeberg](https://codeberg.org/elmir_kuba/norms2),
  [SourceHut](https://git.sr.ht/~elmir_kuba/norms2), [GitFlic](https://gitflic.ru/project/elmirweb/norms2)
  и [GitVerse](https://gitverse.ru/elmir_kuba/norms2) — все пять на каждый коммит. **Сервер пулит с
  GitHub** (пока что). Если GitHub станет недоступен: `git remote set-url origin <адрес зеркала>` в
  `/home/norms2` плюс ключ доступа на сервере — остальной порядок выкатки не меняется. Перед
  переключением **сверить вершину** выбранного зеркала: оно могло не принять последний коммит, если
  в тот момент лежало. Правило зеркал — в [`CLAUDE.md`](../CLAUDE.md).
- **Обновление = `git pull` + пересборка + перезапуск** (см. §5).

### Сервисы (compose-проект `norms2_prod`)

Файл: `docker/compose-files/docker-compose.prod.yml`.

| Сервис | Роль | Порты наружу |
|---|---|---|
| `traefik` (v3.3) | reverse-proxy + авто-TLS (Let's Encrypt). **File-провайдер** без `docker.sock` ([ADR-0045](./decisions/0045-traefik-file-provider.md)) | **80, 443** |
| `angular` | статика SPA (nginx, history-fallback) | — (через Traefik) |
| `nest` | API `/api` + статика `/content` (аватары, релиз-ноты) | — (через Traefik) |
| `postgres` (16) | БД | **нет** (только внутри сети) |
| `migrate` | one-shot: накатывает миграции **до** старта nest, отрабатывает и выходит | — |

### Маршрутизация (same-origin, path-based)

Один домен, без поддоменов и без CORS. Правила — в `docker/traefik/dynamic/routes.yml` (file-провайдер, watch):
- `Host(DOMAIN) && (PathPrefix(/api) || PathPrefix(/content))` → **nest** (приоритет выше);
- `Host(DOMAIN)` → **angular** (всё остальное → SPA).

HTTP (80) → HTTPS (443) — редирект 308. TLS — Let's Encrypt по TLS-ALPN (`certResolver le`, хранилище `/letsencrypt/acme.json`).

---

## 2. Что переживает рестарты (тома)

Три персистентных bind-mount'а в `docker/volumes/` на хосте — **только они хранят состояние**, всё остальное пересоздаётся из образов:

| Том | Куда | Что хранит | Потеря = |
|---|---|---|---|
| `pg_data_prod` | postgres `/var/lib/postgresql/data` | **вся БД** (аккаунты, инвайты, баны, сессии, уведомления…) | потеря всех данных |
| `content` | nest `/app/content` | **загруженные файлы** (аватары; в фазе 2+ — материалы курсов) + релиз-ноты | битые аватары (релиз-ноту сид пере-сеет) |
| `letsencrypt` | traefik `/letsencrypt` | **TLS-серт** (`acme.json`) | перевыпуск при каждом старте → риск упереться в LE rate-limit (5/нед) |

> ⚠️ Тома живут на **диске VDS**. Рестарт/пересоздание контейнеров их не трогает, но **потеря диска уничтожит всё** → нужны бэкапы (§7).

Dev-mount'ы (`nest/src`, `angular/src`, `.git`, `package.json`, `pgadmin`, `seed-content`) в прод **намеренно не переносятся**: код запечён в образ, версия/commit — через build-arg `GIT_COMMIT` ([ADR-0044](./decisions/0044-versioning-strategy.md)), seed-content — `COPY` в образ, pgAdmin в проде нет (БД наружу не публикуется).

---

## 3. Секреты (`.env` на сервере)

`.env` лежит в `/home/norms2/.env`, **вне git** (`.gitignore`). Шаблон — `.env.prod.example` (скопировать, заполнить). Прод-compose читает тот же `.env` (`--env-file .env`).

Ключевое для прода:
```
NODE_ENV=production
COOKIE_SECURE=true            # refresh-cookie только по HTTPS (за Traefik + trust proxy)
CORS_ORIGIN=                  # пусто: same-origin, CORS не нужен
FREE_REGISTRATION=false       # прод — invite-only (ADR-0022)
DOMAIN=xn--h1ahceki4e.xn--p1ai  # punycode!
ACME_EMAIL=<реальная почта для LE>
DB_PASSWORD=<сильный>         # БД наружу не публикуется, но пароль всё равно сильный
JWT_ACCESS_SECRET=<≥32 символов из CSPRNG: openssl rand -base64 36>   # refresh — opaque-токен (не JWT), отдельный секрет не нужен
```
- **Версия продукта** — в файле `VERSION` в корне репо (не в `.env`); бэк читает его и отдаёт в `GET /version`. Бамп версии = правка `VERSION` + коммит (ADR-0044).
- `GIT_COMMIT` в `.env` **не задавать** — он инжектится в образ как build-arg (Makefile: `git rev-parse --short HEAD`); пустой `.env`-вариант перебил бы его.
- Все ENV валидируются zod fail-fast ([ADR-0019](./decisions/0019-backend-architecture-conventions.md)) — кривой/недостающий → бэк не стартует.

---

## 4. Первичный деплой (с нуля, D1.4 — выполнено)

> Делается один раз. Для рутинного обновления — §5.

1. **VDS:** Ubuntu LTS, чистый IP (проверить, что не под ТСПУ — иначе LE не выпишется, см. §8). Поставить `docker`, `docker compose`, `make`, `git`.
2. **Firewall:** открыть только `22/tcp`, `80/tcp`, `443/tcp`, остальное закрыть (§7).
3. **Код:** `git clone https://github.com/ElmirKuba/norms2.git /home/norms2 && cd /home/norms2`.
4. **DNS:** в панели регистратора — запись **A**: `@` → IP сервера (TTL 600). Дождаться распространения.
5. **Секреты:** `cp .env.prod.example .env`, заполнить сильными значениями (§3).
6. **Старт:** `make prod-up` — соберёт образы (если надо), прогонит `migrate`-гейт на чистой БД, поднимет стек. После распространения DNS Traefik выпишет LE-серт.
7. **Smoke** (§6).

---

## 4a. Стейдж-сервер (Emiliya, временный — заведён 05.08.2026)

**Зачем.** Вебхук Telegram требует публичный HTTPS с валидным сертификатом — на `localhost` его
проверить нельзя в принципе. Приёмная заявок (2.9.1·9–·15) без этого проверяется только до
момента отправки, поэтому под неё поднят отдельный сервер.

| | Прод (Johanna) | Стейдж (Emiliya) |
|---|---|---|
| Адрес | `нормисы.рф` → 139.100.225.195 | `stage.нормисы.рф` → 135.106.178.164 |
| SSH | `ssh norms-prod` (ключ `norms_johanna`) | `ssh norms-stage` (ключ `norms_emiliya`) |
| Бот | `@norms2_bot` | `@norms2_stage_bot` |
| Канал | боевой `@norms2` | тестовый «Нормисы — тест» |
| Секреты | `/home/norms2/.env` + архив `norms2-prod/` | `/home/norms2/.env` + архив `norms2-stage/` |

**Поддомен ведёт на стейдж отдельной A-записью, а не через Traefik прода.** Стейдж существует,
чтобы ломаться: если пустить его трафик через прод-Traefik, кривой конфиг или зависший бэкенд
на стейдже заденут боевой сервис, лимиты Let's Encrypt станут общими, а прод получит зависимость
от чужого IP, который через неделю исчезнет.

**Бот тоже отдельный, и это не про удобство:** у бота может быть **ровно один вебхук**. Поставив
его на стейдж, вы отключаете прод, и наоборот. Второй бот снимает вопрос совсем — заодно стейдж
выдаёт настоящие приглашения от чужого имени и в свою БД.

**Вход только по ключу.** `PasswordAuthentication no` выставлен сразу после проверки ключа
(`/etc/ssh/sshd_config.d/99-norms.conf`): root с паролем на 22 порту перебирают непрерывно.
Аварийный доступ — консоль в панели хостинга.

**Развернуть заново** (если сервер пересоздан):
```bash
apt-get install -y docker.io docker-compose-v2 make git ufw
ufw default deny incoming && ufw allow 22,80,443/tcp && ufw --force enable
git clone https://github.com/ElmirKuba/norms2.git /home/norms2
scp ~/KubaPersonal/secrets/norms2-stage/full-stage.env norms-stage:/home/norms2/.env
cd /home/norms2 && make prod-up
```
Сборка на 2 ГБ RAM и 1 vCPU проходит без свопа — проверено 05.08.2026.

**Вебхук ставится один раз** (`setWebhook` с `secret_token` из `.env`, `drop_pending_updates=true`).

⚠️ **Сервер временный.** Удалить, когда приёмная заявок будет проверена: он стоит денег и живёт
с ключом, который больше нигде не нужен. Тогда же убрать A-запись `stage` и вебхук у бота.

---

## 5. Рутинное обновление (выкатка новой версии)

Из корня репо на сервере (`cd /home/norms2`). Makefile сам вычисляет `PROJECT_ROOT` и `GIT_COMMIT`.

```bash
git pull --ff-only origin main     # подтянуть новый код
make prod-build                    # пересобрать образы (нужно при правке кода/Dockerfile)
make prod-up                       # пересоздать изменённые сервисы; migrate-гейт прогонит миграции
```

- **Только код фронта/бэка** → `prod-build` + `prod-up`.
- **Только compose/env** (без правки кода) → достаточно `make prod-up` (пересоздаст изменённые сервисы, без сборки).
- **Миграции** прогоняются автоматически: `nest` стартует только после `migrate` (`depends_on: service_completed_successfully`). Вручную — `make prod-migrate`.
- `GIT_COMMIT` обновляется автоматически (Makefile), `/api/v1/version` начнёт отдавать новый SHA — удобный признак «выкатилось».

### Make-цели (прод)
| Цель | Что делает |
|---|---|
| `make prod-build` | собрать prod-образы (nest, angular) |
| `make prod-up` | поднять/пересоздать стек (`up -d`), migrate-гейт перед nest |
| `make prod-migrate` | накатить миграции отдельно (`run --rm migrate`) |
| `make prod-down` | остановить стек |
| `make prod-config` | отрендерить prod-compose (проверка подстановок) |

---

## 6. Smoke-чек после деплоя

```bash
D=xn--h1ahceki4e.xn--p1ai
curl -sk https://$D/api/v1/version          # {"product","backend","commit"} — commit = свежий SHA
curl -skI http://$D/  | grep -i location    # http → https (308)
curl -sk  https://$D/ | grep -o '<title>[^<]*</title>'   # <title>Нормисы</title>
curl -sk -o /dev/null -w '%{http_code}\n' https://$D/content/notifications/release-1.0.0.md  # 200
```
Плюс при необходимости: логин → `Set-Cookie` refresh (HttpOnly, Secure, SameSite=Lax) + `accessToken` в теле.

---

## 7. Эксплуатация (ops)

### Логи и статус
```bash
cd /home/norms2
docker compose --env-file .env -f docker/compose-files/docker-compose.prod.yml ps      # статус
docker compose --env-file .env -f docker/compose-files/docker-compose.prod.yml logs -f nest   # логи бэка
docker logs -f norms2_traefik_prod          # логи Traefik (TLS/маршруты)
```
> 📌 Удобные `make prod-logs` / `make prod-deploy` (pull+build+up одной командой) — **запланированы в D1.5**, пока команды выше вручную.

### Firewall (D1.5 — настроить)
Открыть только SSH + HTTP + HTTPS, например `ufw`:
```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
```

### Rate-limit
In-memory, по IP+роут (свой guard, без зависимостей). Один инстанс — ок; **счётчики сбрасываются на рестарте nest** (приемлемо для одного инстанса). При горизонтальном масштабировании понадобится внешнее хранилище.

### Фоновые задачи
`@nestjs/schedule` — удаление истёкших `invite_codes` по `expires_at` ([ADR-0023](./decisions/0023-deployment-jurisdiction.md)).

---

## 8. Бэкапы

**Правила, состав, процедура и открытые дыры — отдельный файл [`backup.md`](./backup.md)** (заведён
31.07.2026). Кратко: бэкап **ручной, по запросу** — дамп `pg_dump` + `content/avatars/`, архив
качается на машину Elmir. Тома `pg_data_prod` и `letsencrypt` сознательно **не** копируются, ноты
из `content/notifications/` — тоже (они есть в git).

Данные переживают рестарт (тома §2), но **не потерю диска VDS**: автоматизации, шифрования и
внешней копии пока нет — это открытые пункты, они перечислены в `backup.md` §6.

---

## 9. Траблшутинг

- **LE-серт не выписывается / `acme.json` пустой:** проверить, что DNS A-запись указывает на сервер и распространилась; что порт 443 открыт; что IP **не под ТСПУ-фильтрацией** (история: первый сервер «Kubik» рвал TLS-пакеты → LE падал → пересоздали на чистом IP «Johanna», см. `prod-vds-access`). Проверка извне: `curl -vk https://нормисы.рф`.
- **Traefik не видит docker-сервисы:** так и задумано — мы на **file-провайдере** ([ADR-0045](./decisions/0045-traefik-file-provider.md)), маршруты в `docker/traefik/dynamic/routes.yml`, не из `docker.sock`. Правишь маршруты — Traefik подхватывает по `watch`, без рестарта.
- **Аватары/контент пропали после рестарта:** проверить, что у `nest` есть том `content` (`docker/volumes/content:/app/content`) — без него файлы эфемерны. Мёртвую ссылку в БД обнулить: `UPDATE accounts SET avatar=NULL, version=version+1 WHERE avatar IS NOT NULL;`.
- **`nest` не стартует:** почти всегда — упавший zod-валидатор ENV (смотри логи nest) или не отработавший `migrate` (смотри `docker logs norms2_migrate_prod`).
- **Коллизия dev/prod на одной машине:** проекты изолированы именами (`norms2_dev` / `norms2_prod`) — не путать compose-файлы.

---

## 10. Юрисдикция и готовность к переезду

Хостинг сейчас — РФ (Selectel), домен `нормисы.рф`. Главный щит приватности — **отсутствие ПДн** ([ADR-0001](./decisions/0001-data-minimization-no-pii.md)), не локация. Переезд — только под давлением ([ADR-0023](./decisions/0023-deployment-jurisdiction.md)):
1. Поднять тот же `docker-compose.prod.yml` на не-РФ VDS.
2. Backup-домен (`.com`/`.app` и т.п.), переключить DNS.
3. Перенести БД (бэкап → restore) и `content/`. Портативность обеспечена Docker.

> **Отложено до момента переезда (сейчас действий не требует):** выбор конкретного не-РФ VDS-провайдера и **регистрация backup-домена** (`.com`/`.app`/`.io`) заранее **не делаем** — переезд только под давлением ([ADR-0023](./decisions/0023-deployment-jurisdiction.md)). Триггер — внешнее давление; до него прод штатно на РФ-VDS «Johanna».

Реакция на давление (ADR-0023, доп. 2026-06-10): перенос **или** снос+удаление баз — равноприоритетно по обстоятельствам; участники предупреждены (Terms §6–7).
