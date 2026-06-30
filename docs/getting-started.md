# getting-started.md — локальный запуск с нуля

> Как поднять проект локально. Тулинг — [ADR-0021](./decisions/0021-tooling-defaults.md) + [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md) (npm, Drizzle). Прод-деплой — [`deployment.md`](./deployment.md).

## Требования
- Docker + docker compose.
- `make` (обёртки над compose; вычисляет `PROJECT_ROOT`).
- Node 24 + `npm` — нужны **только** если гонять nest/angular на хосте (необязательно: дефолт — весь стек в докере).

## Состав dev-окружения
`docker/compose-files/docker-compose.dev.yml` (запуск через `make`, см. [`../docker/README.md`](../docker/README.md)) — **весь стек поднимается в докере одной командой**:
- `postgres` (Postgres 16, volume для данных, `init.sql`),
- `pgadmin` (веб-UI Postgres),
- `nest` (бэк, watch-режим — монтируется `nest/src`, hot-reload без пересборки),
- `angular` (фронт, dev-server в watch — монтируется `angular/src`).

Пересборка образов нужна только при смене зависимостей/Dockerfile (`make dev-rebuild`). Гонять nest/angular на хосте по-прежнему можно, но дефолт — «всё в докере».

## Шаги
1. Клонировать репозиторий.
2. Скопировать `.env.example` → `.env` (значения для dev уже подходят).
3. `make dev-rebuild` — соберёт образы и поднимет весь стек (postgres + pgAdmin + nest + angular). **Первая сборка ~15–20 мин**, дальше быстро. Статус — `make dev-ps`, логи — `make dev-logs`. (Без пересборки: `make dev-up` в форграунде или `make dev-up-detach` в фоне.)
4. Накатить миграции Drizzle: `make db-migrate`.
5. Открыть: фронт — `http://localhost:4200`, API — `http://localhost:3000/api/v1`, pgAdmin — `http://localhost:8081`.

## `.env` (dev)
Полный шаблон — [`../.env.example`](../.env.example) (значения для dev уже подходят). Ключевое: `FREE_REGISTRATION=true` (рега без кода), `DB_NAME=DB_USER=DB_PASSWORD=norms2`, `DB_HOST=norms2_postgres_dev` (внутри Docker-сети; для бэка на хосте — `localhost`), `COOKIE_SECURE=false`. Порты: `FRONTEND_PORT=4200`, `BACKEND_PORT=3000`, `PGADMIN_PORT=8081`, `DB_PORT=5432`.

## Замечания для dev
- **TLS локально не нужен** — по HTTP всё работает; плейнтекст-секреты защищает TLS только в проде/интернет-стенде ([ADR-0009](./decisions/0009-server-side-hashing.md)).
- `FREE_REGISTRATION=true` → регистрация без кода приглашения; первый аккаунт — корень (`registration_source=free`).
- Закрытый режим для теста — `FREE_REGISTRATION=false`, создать инвайт из настроек первого аккаунта и регистрироваться по коду.
- **Не делать `docker restart` контейнера `nest`** (watch-гонка `dist/main` → крэш); если стек «поплыл» — `make dev-down && make dev-rebuild`.

## Полезные команды (`make`, обёртки над docker compose)
- `make dev-up` / `dev-up-detach` / `dev-down` / `dev-rebuild` / `dev-ps` / `dev-logs` — жизненный цикл dev-стека.
- `make db-generate` — сгенерить миграцию из ORM-схем (drizzle-kit).
- `make db-migrate` — накатить миграции на БД.
- `make db-studio` — GUI по БД (drizzle-kit studio).
- `make db-psql` — psql в dev-Postgres.
- На хосте (если вне докера): `cd nest && npm install && npm run start:dev`; `cd angular && npm install && npm start`.
