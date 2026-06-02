# getting-started.md — локальный запуск с нуля

> Как поднять проект локально. Тулинг — [ADR-0021](./decisions/0021-tooling-defaults.md) + [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md) (npm, Drizzle). Прод-деплой — `deployment.md`.

## Требования
- Docker + docker compose.
- `make` (обёртки над compose; вычисляет `PROJECT_ROOT`).
- Node 24 и `npm` (бэк/фронт в dev запускаются на хосте + миграции).

## Состав dev-окружения
`docker/compose-files/docker-compose.dev.yml` (запуск через `make`, см. [`../docker/README.md`](../docker/README.md)):
- `postgres` (Postgres 16, volume для данных, `init.sql`),
- `pgadmin` (веб-UI Postgres).

Бэк (`nest`) и фронт (`angular`) в dev поднимаются **на хосте** (быстрее, нативный hot-reload). Их сервисы есть в compose, но закомментированы — включатся после этапа B2 (Drizzle/конфиг).

## Шаги
1. Клонировать репозиторий.
2. Скопировать `.env.example` → `.env` (значения для dev уже подходят).
3. `make dev-up-detach` — поднимет Postgres + pgAdmin + nest (в фоне). Проверить: `make dev-ps`. (Или `make dev-up` — в форграунде с логами.)
4. В отдельных терминалах: `cd nest && npm install && npm run start:dev`; `cd angular && npm install && npm start`.
5. (после B2) Прогнать миграции Drizzle: `cd nest && npm run db:migrate`.
6. Открыть фронт на `http://localhost:${FRONTEND_PORT}` (по умолчанию 4200), pgAdmin — `http://localhost:${PGADMIN_PORT}` (8081).

## `.env` (dev)
Полный шаблон — [`../.env.example`](../.env.example) (значения для dev уже подходят). Ключевое: `FREE_REGISTRATION=true` (рега без кода), `DB_NAME=DB_USER=DB_PASSWORD=norms2`, `DB_HOST=norms2_postgres_dev` (внутри Docker-сети; для бэка на хосте — `localhost`), `COOKIE_SECURE=false`.

## Замечания для dev
- **TLS локально не нужен** — по HTTP всё работает; плейнтекст-секреты защищает TLS только в проде/интернет-стенде ([ADR-0009](./decisions/0009-server-side-hashing.md)).
- `FREE_REGISTRATION=true` → можно регистрироваться без кода приглашения; первый аккаунт — корень (`registration_source=free`).
- Чтобы протестировать закрытый режим — поставить `FREE_REGISTRATION=false`, создать инвайт из настроек первого аккаунта и регистрироваться по коду.

## Полезные команды (в `nest/` и `angular/`)
- `npm install` — зависимости.
- `npm start` / watch — запуск вне Docker.
- `npm run db:generate` / `db:migrate` — миграции Drizzle (только бэк, drizzle-kit).
- `npm test` — тесты.
