# getting-started.md — локальный запуск с нуля

> Как поднять проект локально. Тулинг — [ADR-0021](./decisions/0021-tooling-defaults.md) + [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md) (npm, Drizzle). Прод-деплой — `deployment.md`.

## Требования
- Docker + docker-compose.
- Node LTS ≥20 и `npm` (для запуска вне Docker / миграций).

## Состав dev-окружения
`docker-compose.dev.yml`:
- `postgres` (с volume для данных),
- `nest` (backend, watch-режим),
- `angular` (dev-server).

## Шаги
1. Клонировать репозиторий.
2. Скопировать `.env.example` → `.env` (значения для dev уже подходят).
3. `docker compose -f docker-compose.dev.yml up` — поднимет Postgres, бэк и фронт.
4. Прогнать миграции (бэк, Drizzle): `npm run db:migrate` (внутри контейнера `nest` или локально с доступом к БД).
5. Открыть фронт на `http://localhost:<порт>` (порт — в compose).

## `.env.example` (dev)
```
FREE_REGISTRATION=true          # в dev регистрация открытая, код не нужен
JWT_ACCESS_SECRET=dev-access-secret
JWT_REFRESH_SECRET=dev-refresh-secret
ACCESS_TTL=15m
REFRESH_TTL=30d
COOKIE_SECURE=false             # dev по HTTP; в проде true
DB_HOST=postgres
DB_PORT=5432
DB_NAME=normis
DB_USER=normis
DB_PASSWORD=normis
INVITE_DEFAULT_QUOTA=3
INVITE_TTL_DAYS=3
SECURITY_LOG_TTL_DAYS=60
```

## Замечания для dev
- **TLS локально не нужен** — по HTTP всё работает; плейнтекст-секреты защищает TLS только в проде/интернет-стенде ([ADR-0009](./decisions/0009-server-side-hashing.md)).
- `FREE_REGISTRATION=true` → можно регистрироваться без кода приглашения; первый аккаунт — корень (`registration_source=free`).
- Чтобы протестировать закрытый режим — поставить `FREE_REGISTRATION=false`, создать инвайт из настроек первого аккаунта и регистрироваться по коду.

## Полезные команды (в `nest/` и `angular/`)
- `npm install` — зависимости.
- `npm start` / watch — запуск вне Docker.
- `npm run db:generate` / `db:migrate` — миграции Drizzle (только бэк, drizzle-kit).
- `npm test` — тесты.
