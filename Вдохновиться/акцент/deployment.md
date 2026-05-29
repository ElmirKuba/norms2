# Deployment

Self-hosted развёртывание через Docker Compose. Никаких облачных зависимостей по умолчанию.

См. также: [`./getting-started.md`](./getting-started.md) — для локальной разработки, [`./architecture.md`](./architecture.md) — общий обзор.

## Цель

Один `docker-compose up -d` поднимает весь стек на чистом Linux-сервере (Ubuntu 22.04 / Debian 12). Никаких внешних API-ключей не требуется для базового функционала.

## Структура развёртывания

```
ascent/
├── docker-compose.yml         # dev (локальная разработка)
├── docker-compose.prod.yml    # prod (с Caddy и production-image-ами)
├── .env                       # секреты для prod (не в git)
├── .env.example               # шаблон с описанием
├── nest/
│   └── Dockerfile             # multi-stage: builder + runner
├── angular/
│   └── Dockerfile             # multi-stage: builder + nginx (или встроить в Caddy)
└── scripts/
    ├── backup.sh
    ├── restore.sh
    └── migrate.sh
```

## docker-compose.yml (dev)

Минимальный набор для локальной разработки — БД и Redis в контейнерах, бэк и фронт запускаются нативно (быстрее итерации):

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ascent
      POSTGRES_USER: ascent
      POSTGRES_PASSWORD: dev_password_change_me
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ascent']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## docker-compose.prod.yml

Полный стек с приложениями и обратным прокси:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  api:
    build:
      context: ./nest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_TTL: 15m
      JWT_REFRESH_TTL: 30d
      CORS_ORIGINS: ${PUBLIC_URL}
      LOG_LEVEL: info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  web:
    build:
      context: ./angular
      args:
        API_URL: ${PUBLIC_URL}/api
    restart: unless-stopped
    depends_on:
      - api

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

## Caddyfile

```
{$PUBLIC_DOMAIN} {
    encode gzip zstd

    handle /api/* {
        reverse_proxy api:3000
    }

    handle /ws {
        reverse_proxy api:3000
    }

    handle {
        reverse_proxy web:80
    }
}
```

Caddy автоматически выпускает Let's Encrypt сертификат для `PUBLIC_DOMAIN` (порты 80/443 должны быть открыты, домен указывает на сервер).

## Переменные окружения

Полный перечень. `.env.example` в корне дублирует с описаниями.

| Имя | Где | Описание | Пример |
|---|---|---|---|
| `NODE_ENV` | nest | окружение | `production` |
| `PORT` | nest | порт API | `3000` |
| `DATABASE_URL` | nest | postgres URL | `postgres://user:pass@postgres:5432/ascent` |
| `REDIS_URL` | nest | redis URL | `redis://redis:6379` |
| `JWT_ACCESS_SECRET` | nest | ≥32 символа, случайная строка | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | nest | (если используется JWT для refresh; иначе опускается) | |
| `JWT_ACCESS_TTL` | nest | TTL access | `15m` |
| `JWT_REFRESH_TTL` | nest | TTL refresh | `30d` |
| `CORS_ORIGINS` | nest | список через запятую | `https://ascent.example.com` |
| `LOG_LEVEL` | nest | pino-уровень | `info` |
| `POSTGRES_DB` | compose | имя БД | `ascent` |
| `POSTGRES_USER` | compose | | `ascent` |
| `POSTGRES_PASSWORD` | compose | | `<strong>` |
| `PUBLIC_URL` | compose | внешний URL | `https://ascent.example.com` |
| `PUBLIC_DOMAIN` | caddy | домен для TLS | `ascent.example.com` |
| `API_URL` (build-arg) | angular | API базовый URL для билда | `https://ascent.example.com/api` |

## Backup

Скрипт `scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$BACKUP_DIR/ascent-$TIMESTAMP.sql.gz"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$FILE"

# ротация: оставить последние 30 файлов
ls -1t "$BACKUP_DIR"/ascent-*.sql.gz | tail -n +31 | xargs -r rm

echo "Backup saved to $FILE"
```

Запускать через cron каждую ночь:
```
0 3 * * * cd /opt/ascent && ./scripts/backup.sh >> /var/log/ascent-backup.log 2>&1
```

## Restore

```bash
#!/usr/bin/env bash
set -euo pipefail
FILE="$1"

zcat "$FILE" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Перед restore — `docker compose stop api` (чтобы не было активных коннектов).

## Миграции в продакшене

Не выполняются автоматически при старте контейнера. Это намеренно — ошибочная миграция не должна положить рабочий инстанс.

Скрипт `scripts/migrate.sh`:
```bash
#!/usr/bin/env bash
set -e
docker compose -f docker-compose.prod.yml exec api npm run migration:run
```

Workflow обновления:
1. `git pull`
2. `docker compose -f docker-compose.prod.yml build api web`
3. `./scripts/backup.sh`
4. `./scripts/migrate.sh`
5. `docker compose -f docker-compose.prod.yml up -d`

## Мониторинг

Минимально:
- Healthcheck `GET /api/health` — мониторится Caddy и uptime-сервисом по выбору пользователя (Uptime Kuma — рекомендуется как тоже self-hosted).
- Логи в stdout, читаются через `docker compose logs -f`.
- Опционально: добавить `loki + grafana` как отдельный сервис в фазе 9.

## Без облака

Намеренно НЕ используются:
- ❌ AWS / GCP / Azure
- ❌ Sentry / DataDog (можно подключить через env, но не дефолт)
- ❌ Vercel / Netlify
- ❌ Stripe / любые платежи

Всё на локальном/арендованном железе. Минимум: 1 vCPU, 1 GB RAM, 10 GB диска для одного пользователя с годом данных.

## Чеклист deployment-готовности (фаза 9)

- [ ] `docker-compose.prod.yml` запускается на чистой машине без правок
- [ ] `.env.example` содержит все переменные с описаниями
- [ ] HTTPS работает через Caddy
- [ ] Бэкапы запускаются и восстанавливаются
- [ ] Логи структурированы (JSON), без секретов
- [ ] Health-эндпоинт отвечает за < 100ms
- [ ] CI собирает образы и пушит в registry (опционально)
