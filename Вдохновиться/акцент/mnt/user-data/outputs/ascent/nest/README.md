# nest/

Здесь живёт бэкенд на **NestJS 10 + TypeORM + PostgreSQL + Redis (BullMQ)**.

На момент написания этого файла папка пустая — проект ещё не инициализирован. Это нормально: бутстрап — первый шаг **Фазы 1** в [`../todo.md`](../todo.md).

## Перед тем как писать код — прочитать

1. [`../Technical-assignment.md`](../Technical-assignment.md) — что строим
2. [`../claude.md`](../claude.md) — как работаем
3. [`../docs/architecture.md`](../docs/architecture.md) — общие границы
4. [`../docs/backend.md`](../docs/backend.md) — конвенции бэка (модули, слои, DTO, конфиги)
5. [`../docs/database.md`](../docs/database.md) — схема и миграции
6. [`../docs/api-contracts.md`](../docs/api-contracts.md) — REST + WebSocket контракты

## Инициализация (первый раз)

Из корня репо:

```bash
npx @nestjs/cli@latest new nest --package-manager npm --strict
cd nest
```

Дальше — ставим стек согласно [`../docs/backend.md`](../docs/backend.md):

```bash
npm install @nestjs/typeorm typeorm pg \
            @nestjs/config joi \
            @nestjs/jwt @nestjs/passport passport passport-jwt \
            @nestjs/bullmq bullmq ioredis \
            @nestjs/event-emitter \
            @nestjs/websockets @nestjs/platform-socket.io socket.io \
            @nestjs/throttler helmet \
            class-validator class-transformer \
            bcrypt nestjs-pino pino-http rrule
npm install -D @types/bcrypt @types/passport-jwt
```

Дальнейшая структура папок, конфиги, скрипты `package.json`, схема `tsconfig.json` — всё в [`../docs/backend.md`](../docs/backend.md). Не импровизируй, сверяйся с документом — это сэкономит кучу рефакторинга.

## Запуск (когда проект уже инициализирован)

См. [`../docs/getting-started.md`](../docs/getting-started.md#шаг-3-поднять-бэк-nestjs).

## Когда трогать этот README

Когда проект инициализирован — заменить этот текст на нормальный README с описанием модулей, скриптов, env-переменных, ссылками на документацию.
