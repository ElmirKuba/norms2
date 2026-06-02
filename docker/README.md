# docker/ — контейнеризация «Нормисов»

> Вся инфраструктура (dev + prod) в Docker. Решения по деплою — [`../docs/deployment.md`](../docs/deployment.md), локальный запуск — [`../docs/getting-started.md`](../docs/getting-started.md). Полный full-stack (nest + angular + postgres), монорепо **без** workspace.

## Принцип структуры

```
docker/
├─ compose-files/      # оркестрация: dev и prod — отдельные файлы
│  ├─ docker-compose.dev.yml
│  └─ docker-compose.prod.yml
├─ dockerfiles/        # образы по сервисам, dev и prod — отдельные Dockerfile
│  ├─ nest-backend/     Dockerfile.development · Dockerfile.production
│  └─ angular-frontend/ Dockerfile.development · Dockerfile.production · nginx.conf
├─ sql-files/          # init.sql — выполняется при первом старте Postgres
└─ volumes/            # данные контейнеров (НЕ в git, только .gitkeep)
```

Принцип: **dev и prod разведены** и в compose, и в Dockerfile; образы — **по сервису**; данные — в `volumes/` и вне git.

## Контекст сборки

Монорепо без workspace → **контекст сборки = корень репозитория** (`context: ./../../`), а пути `COPY` в Dockerfile указывают внутрь `nest/` или `angular/`. Лишнее из контекста режет корневой [`.dockerignore`](../.dockerignore).

## Запуск (dev)

Из корня репозитория:

```bash
docker compose --env-file .env -f docker/compose-files/docker-compose.dev.yml up -d
```

Сейчас активны **postgres** (`localhost:${DB_PORT}`) и **pgAdmin** (`localhost:${PGADMIN_PORT}`). Бэкенд и фронт в dev обычно поднимаются на хосте (`cd nest && npm run start:dev`, `cd angular && npm start`); их сервисы в compose закомментированы и включатся после этапа B2 (Drizzle/конфиг готовы).

Переменные окружения — из корневого `.env` (шаблон — [`../.env.example`](../.env.example)).

## Prod

`docker-compose.prod.yml` — черновик этапа D1: Traefik (авто-TLS Let's Encrypt, HTTP→HTTPS), postgres (без публикации портов), nest (`api.${DOMAIN}`), angular-статика (`${DOMAIN}`). Финализируется при настройке VPS; секреты — только из защищённого `.env` на сервере. Drizzle-миграции — отдельным шагом до старта `nest` (auto-push запрещён, [ADR-0030](../docs/decisions/0030-stack-revision-drizzle-5layer-npm.md)).
