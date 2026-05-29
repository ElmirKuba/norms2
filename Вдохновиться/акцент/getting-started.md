# Getting Started

Поднимаем Ascent локально с нуля. Если что-то ломается — смотри [Troubleshooting](#troubleshooting) внизу.

См. также: [`./architecture.md`](./architecture.md) — что мы поднимаем; [`./deployment.md`](./deployment.md) — production-разворот; [`../claude.md`](../claude.md) — рабочий процесс.

## Prerequisites

| Инструмент | Версия | Зачем |
|---|---|---|
| Node.js | 20.x LTS | Бэк (NestJS) и фронт (Angular) |
| npm | 10.x (идёт с Node 20) | Менеджер пакетов |
| Docker | 24+ | PostgreSQL и Redis в контейнерах |
| Docker Compose | v2 (плагин `docker compose`) | Оркестрация |
| Git | любая свежая | Очевидно |

Опционально:

- `psql` (postgres-client) — для ручных запросов в БД
- `redis-cli` — для отладки очередей
- `direnv` или аналог — чтобы не экспортировать `.env` руками

Проверка версий:

```bash
node -v        # v20.x
npm -v         # 10.x
docker -v      # Docker version 24.x+
docker compose version
```

## Шаг 1. Клонировать и подготовить окружение

```bash
git clone <repo-url> ascent
cd ascent
cp .env.example .env
```

Открой `.env` и убедись, что значения для dev совпадают с теми, что захардкожены в `docker-compose.yml` (БД, пароли). Для локалки можно оставить дефолты — секреты подкрутишь только перед prod-разворотом (см. [`./deployment.md`](./deployment.md#переменные-окружения)).

## Шаг 2. Поднять PostgreSQL и Redis

В корне репо:

```bash
docker compose up -d
```

Это поднимает только инфраструктуру (postgres + redis). Бэк и фронт запускаются нативно — итерации быстрее, дебаг проще. Полный стек в контейнерах — это сценарий prod, см. [`./deployment.md`](./deployment.md).

Проверка:

```bash
docker compose ps
# postgres  running (healthy)
# redis     running

# Подключиться к БД (опционально)
docker compose exec postgres psql -U ascent -d ascent -c '\dt'
# Список пуст — миграции ещё не накатаны, это норма
```

## Шаг 3. Поднять бэк (NestJS)

```bash
cd nest
npm install
npm run migration:run    # накатить миграции БД
npm run start:dev        # nest start --watch
```

Бэк слушает на `http://localhost:3000`. Префикс API — `/api` (см. [`./api-contracts.md`](./api-contracts.md)).

Smoke-тест:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","db":"ok","redis":"ok"}
```

Если БД пустая и нужны тестовые данные:

```bash
npm run seed             # создаёт пользователя dev@local / password, дефолтные шаблоны
```

## Шаг 4. Поднять фронт (Angular)

В отдельном терминале:

```bash
cd angular
npm install
npm start                # ng serve --proxy-config proxy.conf.json
```

Фронт на `http://localhost:4200`. `proxy.conf.json` проксирует `/api` и `/ws` на `localhost:3000`, поэтому CORS-проблем в dev нет.

Открой браузер на `http://localhost:4200`, залогинься под seed-юзером (`dev@local` / `password`), увидишь дашборд с дефолтными задачами.

## Шаг 5. Что делать дальше

- Прочитать [`../Technical-assignment.md`](../Technical-assignment.md) целиком, чтобы понять, что мы вообще строим.
- Прочитать [`../claude.md`](../claude.md) и [`../todo.md`](../todo.md) — рабочий процесс и текущая фаза.
- Открыть [`./architecture.md`](./architecture.md) и [`./domain-model.md`](./domain-model.md) перед первым PR в бэк.
- Открыть [`./ui-ux.md`](./ui-ux.md) и [`./frontend.md`](./frontend.md) перед первым PR во фронт.

## Полезные команды

### Бэк (`./nest/`)

```bash
npm run start:dev              # watch-режим
npm run build                  # production-сборка
npm run test                   # unit-тесты (Jest)
npm run test:e2e               # e2e-тесты против тестовой БД
npm run migration:generate -- src/migrations/<Name>   # сгенерировать миграцию из изменений entity
npm run migration:create -- src/migrations/<Name>     # создать пустую миграцию (для DDL вручную)
npm run migration:run                                  # накатить
npm run migration:revert                               # откатить последнюю
npm run lint
npm run format
```

### Фронт (`./angular/`)

```bash
npm start                      # ng serve
npm run build                  # production-сборка в dist/
npm run test                   # Karma + Jasmine
npm run lint
```

### Инфраструктура

```bash
docker compose up -d           # поднять postgres + redis
docker compose down            # остановить (volumes остаются)
docker compose down -v         # ОСТОРОЖНО: удаляет volumes (всю БД)
docker compose logs -f postgres
docker compose exec postgres psql -U ascent -d ascent
docker compose exec redis redis-cli
```

## Структура репо

```
ascent/
├── Technical-assignment.md     # ТЗ
├── claude.md                   # инструкции для агента
├── todo.md                     # план работ по фазам
├── docs/                       # техническая документация
├── nest/                       # бэк (NestJS)
├── angular/                    # фронт (Angular)
├── docker-compose.yml          # dev: postgres + redis
├── docker-compose.prod.yml     # prod: + api + web + caddy
├── .env.example
└── scripts/                    # backup, restore, migrate
```

## Troubleshooting

### `EADDRINUSE: 3000` или `4200`

На порту уже что-то висит. Найти и прибить:

```bash
lsof -i :3000
kill -9 <PID>
```

Или изменить порт через `PORT=3001 npm run start:dev`.

### `connection refused` к postgres

Контейнер не поднят или ещё не прошёл healthcheck. Подожди 5–10 секунд после `docker compose up -d` или проверь логи:

```bash
docker compose ps
docker compose logs postgres
```

### `password authentication failed`

`.env` локального бэка не совпадает с тем, что в `docker-compose.yml`. Сверь `DATABASE_URL` или `POSTGRES_*` переменные.

### Миграции выдают `relation "..." already exists`

Кто-то накатил миграции вручную или БД в неконсистентном состоянии. Самый чистый путь для dev:

```bash
docker compose down -v          # удалит volume
docker compose up -d
cd nest && npm run migration:run && npm run seed
```

В prod — никогда так не делать. Чинить руками через `psql`.

### Angular: `Module not found` после `git pull`

Кто-то добавил зависимость:

```bash
cd angular && npm install
```

То же для `nest/` после `git pull`.

### WebSocket не подключается

Проверь, что бэк поднят, и что `proxy.conf.json` фронта проксирует `/ws` (а не только `/api`). Подробности — в [`./api-contracts.md`](./api-contracts.md#websocket).

### `out of memory` при `ng build`

Angular иногда жрёт память при большом проекте. Подними лимит Node:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

## Минимальный smoke-чеклист "всё работает"

- [ ] `docker compose ps` показывает postgres и redis как `healthy`/`running`
- [ ] `curl http://localhost:3000/api/health` отдаёт `200 OK` со статусами `db: ok`, `redis: ok`
- [ ] `http://localhost:4200` открывается, форма логина рендерится
- [ ] Логин под seed-юзером работает, после редиректа виден дашборд
- [ ] В DevTools → Network видно успешное WebSocket-соединение `/ws`
- [ ] Отметка задачи на дашборде сразу обновляет donut-чарт без перезагрузки страницы

Если все галки — окружение собрано правильно, можно открывать [`../todo.md`](../todo.md) и брать первую открытую задачу.
