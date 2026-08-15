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

## 4a. Стейдж: второй стек на той же машине (05.08.2026 — **разобран 09–10.08.2026**)

> ⛔ **Стейджа больше нет, и восстановить его копипастой не выйдет.** Стек снесён 09.08.2026
> (реш. Elmir: прод становится дев-продом, проверяем на бою), а 10.08.2026 Elmir удалил и его
> телеграм-половину — **бота `@norms2_stage_bot` и канал «Нормисы — тест»**. Значит из раздела
> ниже мертвы не только контейнеры: заново понадобится новый бот у `@BotFather`, новый тестовый
> канал, новый `secret_token` и новый `setWebhook`. Раздел оставлен как **рецепт и разбор
> граблей**, а не как описание существующего стенда.
>
> Побочное следствие, о котором легко забыть: тестовый канал использовал и **локальный dev** —
> в корневом `.env` он стоял в `TELEGRAM_CHANNEL_ID`, а `TELEGRAM_BOT_USERNAME` указывал на
> удалённого бота, из-за чего фронт рисовал ссылку в никуда. Обе переменные обнулены 10.08.2026;
> локально бот и так работает на логирующем адаптере (токен в dev пуст).

**Зачем.** Вебхук Telegram требует публичный HTTPS — на `localhost` его не проверить в принципе.
Приёмная заявок (2.9.1·9–·15) без этого проверяется только до момента отправки.

**Почему на прод-машине, а не отдельным сервером.** Сначала стейдж подняли отдельно (Selectel,
`135.106.x`) и упёрлись: до Telegram он не достукивается **ни в одну сторону** — блокировка
точечная, по IP-маршруту, а у прода того же провайдера её нет. Исходящие чинятся пином рабочего
IP из пула Telegram, **входящие — нет**: адрес, на который стучится Telegram, выбираем не мы.
Значит стейдж обязан жить там, где маршрут рабочий. Разбор — в [ADR-0064](./decisions/0064-telegram-release-channel.md).

**Раскладка на Johanna:**

| | Прод | Стейдж |
|---|---|---|
| Папка | `/home/norms2` | `/home/norms2_stage` (отдельный клон, **свой `.env`**) |
| Домен | `нормисы.рф` | `stage.нормисы.рф` (A-запись на тот же IP) |
| Compose | `docker-compose.prod.yml` | `docker-compose.stage.yml` (`make stage-up`) |
| Контейнеры | `norms2_*_prod` | `norms2_*_stage` |
| БД | свой том `pg_data_prod` | свой том `pg_data_stage` |
| Бот | `@norms2_bot` | `@norms2_stage_bot` |
| Канал | боевой `@norms2` | тестовый «Нормисы — тест» |
| Секреты | архив `norms2-prod/` | архив `norms2-stage/johanna-stage.env` |

**Traefik один на машину** — порты 80/443 не делятся. Стейдж своего прокси не поднимает:
маршруты лежат в [`docker/traefik/dynamic/stage-routes.yml`](../docker/traefik/dynamic/stage-routes.yml)
и подхватываются на лету (`--providers.file.watch`), **прод при этом не перезапускается**.

Два решения там, которые стоит понимать:
- **прод-роутеры не тронуты.** Они матчат любой хост; добавь мы туда `Host(...)`, опечатка
  уронила бы боевой сайт. Вместо этого стейдж перехватывает свой домен приоритетом 20/21 против
  прод-ных 10/1;
- **сертификат запрашивается на уровне роутера**, а не в статической команде Traefik — иначе
  пришлось бы перезапускать прод-прокси ради стейджа.

**Изоляция и её граница.** БД стейджа — только в своей сети. `nest` стейджа подключён к двум
сетям, чтобы до него дотянулся Traefik, и это значит, что технически он видит `norms2_postgres_prod`.
Защита здесь не сетевая, а в `.env`: у стейджа свои `DB_*`. Помнить об этом при отладке.

**Развернуть заново:**
```bash
git clone https://github.com/ElmirKuba/norms2.git /home/norms2_stage
scp ~/KubaPersonal/secrets/norms2-stage/johanna-stage.env norms-prod:/home/norms2_stage/.env
cd /home/norms2_stage && make stage-up
```

**Вебхук** ставится один раз: `setWebhook` на `https://stage.нормисы.рф/api/v1/telegram/webhook`
с `secret_token` из стейджевого `.env` и `drop_pending_updates=true`.

**Грабля при переезде домена на другой IP** (поймана 05.08.2026). Traefik запросил сертификат
раньше, чем истёк DNS-кеш Let's Encrypt, получил `invalid authorization` со **старым** адресом —
и **закешировал неудачный ордер**. Правка файла маршрутов повторную попытку не запускает: помогает
только `docker restart norms2_traefik_prod`. Порядок правильный такой: сменить A-запись → погасить
стек на старом IP, чтобы он не отвечал на проверки → дождаться TTL → перезапустить Traefik.
Перезапуск прокси — это секундная пауза на проде, пересборки не требует.

⚠️ **Стейдж временный.** Когда приёмная заявок проверена — `make stage-down`, удалить папку,
A-запись и вебхук у стейдж-бота: он ест память на боевой машине.

---

## 4b. Telegram через туннель + long polling (15.08.2026)

**Зачем.** Маршрут между инфраструктурой Telegram и IP прода закрылся в обе стороны: исходящие
дали **0 успешных из 8**, доставка апдейтов к нам — `Connection timed out`. Сервер при этом
здоров, снаружи отвечает `200`. Разбор и цена решения —
[ADR-0064 → «Дополнение 15.08.2026»](./decisions/0064-telegram-release-channel.md).

**Что стоит на сервере:**

```bash
# Клиент VLESS: HTTP-прокси 1080 внутри docker-сети, наружу НЕ опубликован.
# Конфиг с ключами — вне репозитория, режим 600, от root.
/opt/norms2-proxy/config.json
docker run -d --name norms2_xray_prod --restart unless-stopped --user 0:0 \
  --network norms2_prod-net -v /opt/norms2-proxy/config.json:/etc/xray/config.json:ro \
  ghcr.io/xtls/xray-core:latest run -c /etc/xray/config.json
```

**Что добавлено в `/home/norms2/.env`:**

```
TELEGRAM_PROXY_URL=http://norms2_xray_prod:1080
NODE_USE_ENV_PROXY=1
TELEGRAM_UPDATES_MODE=polling
```

⚠️ **Переменная называется `TELEGRAM_PROXY_URL`, а не `HTTPS_PROXY`, — и это важно.** Makefile
делает `include .env` + `export`, поэтому строка `HTTPS_PROXY=` утекает в окружение самого
`docker build`, и сборка падает с `lookup norms2_xray_prod: no such host` (имя из docker-сети с
хоста не резолвится — поймано при выкатке 15.08.2026). Контейнеру бэкенда её раздаёт compose через
`environment:`, уже внутри сети.

Правки кода под прокси **не потребовалось**: Node 24 уводит `fetch` в прокси сам при
`NODE_USE_ENV_PROXY=1`. Это безопасно потому, что исходящих `fetch` вне модуля бота в бэкенде нет.

**Проверка после изменений:**

```bash
docker exec norms2_nest_prod node -e "fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/getMe').then(r=>r.json()).then(j=>console.log(j.ok))"
```

**Возврат к вебхуку**, если маршрут откроется: `TELEGRAM_UPDATES_MODE=webhook` в `.env`, перезапуск
бэкенда, затем `setWebhook` с прежним секретом. Прокси при этом можно оставить — он чинит
исходящие независимо от режима.

⚠️ **Новая точка отказа:** пока режим `polling`, бот зависит от туннеля целиком — упадёт `xray`,
встанут обе половины, а не одна. Контейнер поднят с `--restart unless-stopped`.

---

## 5. Рутинное обновление (выкатка новой версии)

Из корня репо на сервере (`cd /home/norms2`). Makefile сам вычисляет `PROJECT_ROOT` и `GIT_COMMIT`.

> ⚠️ **Сервер пулит `main`, а разработка с 14.08.2026 идёт в `developing-2.10`.** Значит обычная
> выкатка «подтянул и собрал» приносит на прод **только то, что слито в `main`** — то есть
> презентуемое состояние 2.9.3. Это сделано намеренно ([CLAUDE.md → три ветки](../CLAUDE.md)):
> пока не решён вопрос прав на результат, боевой сервер не уезжает вперёд того, что мы покажем.
> Выкатить работу подфазы 2.10 = сначала слить её в `main` (или явно сменить ветку на сервере —
> и тогда не забыть вернуть).

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
