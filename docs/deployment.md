# deployment.md — деплой и эксплуатация

> Прод-деплой и ops. Решения — [ADR-0023](./decisions/0023-deployment-jurisdiction.md). Локальный запуск — [`getting-started.md`](./getting-started.md). ENV пересекается с [`backend.md`](./backend.md).

## Юрисдикция (текущая позиция)
На время разработки — **хостинг в РФ допустим**, домен `нормисы.рф`. Переезд вне РФ — **только под давлением** (блокировки/требования). Главный щит — **отсутствие ПДн** ([ADR-0001](./decisions/0001-data-minimization-no-pii.md)), а не локация. Готовность к переезду сохраняется за счёт портативности Docker; backup-домен — позже ([ADR-0023](./decisions/0023-deployment-jurisdiction.md)).

## Стек деплоя
- **Docker + docker-compose** (`docker-compose.prod.yml`): `postgres`, `nest`, `angular` (статика), `traefik`.
- **Traefik** — reverse-proxy + авто-TLS Let's Encrypt (docker-native, лейблы на сервисах). HTTP→HTTPS редирект.
- **Ubuntu LTS** VPS, SSH-ключи, firewall (только 80/443/SSH), деплой по SSH + git.

## TLS
- Let's Encrypt через Traefik (ACME). `COOKIE_SECURE=true` в проде (refresh-cookie). Локально/dev — HTTP допустим ([ADR-0009](./decisions/0009-server-side-hashing.md)).

## ENV (прод)
Все через `ConfigService`, валидируются zod fail-fast ([ADR-0019](./decisions/0019-backend-architecture-conventions.md)). Секреты — вне репозитория (`.env` в `.gitignore`), на сервере — через защищённый `.env`/секрет-стор.
`FREE_REGISTRATION=false` (прод, invite-only — [ADR-0022](./decisions/0022-concept-and-philosophy.md)), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TTL`, `REFRESH_TTL`, `COOKIE_SECURE=true`, `DB_*`, `INVITE_DEFAULT_QUOTA=3`, `INVITE_TTL_DAYS=3`, `AVATAR_MAX_BYTES`. (security_logs не ведём — [ADR-0032](./decisions/0032-phase1-refinements.md).)

## Фоновые задачи (sweep)
- `@nestjs/schedule` ([ADR-0023](./decisions/0023-deployment-jurisdiction.md)): удаление истёкших `invite_codes` (по `expires_at`). Папка `content/` (включая `avatars/`) — в бэкапах.

## Бэкапы Postgres
- Регулярный `pg_dump` (cron на хосте), хранение со сроком, бэкап **шифровать** (gpg/age). Стратегию частоты/ретеншена зафиксировать при настройке сервера. Восстановление тестировать.

## Миграции при деплое
- Отдельный шаг: применить Drizzle-миграции (`npm run db:migrate`, drizzle-kit) до старта нового бэка; auto-push в проде запрещён ([ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)).

## Готовность к переезду (при давлении)
1. Поднять окружение на не-РФ VPS (тот же docker-compose).
2. Купить backup-домен (`.com` и т.п. — [ADR-0023](./decisions/0023-deployment-jurisdiction.md)/B6), переключить DNS.
3. Перенести БД (бэкап→restore). Портативность обеспечена Docker.

## Cookie-гейт
Фронт показывает блокирующий cookie-гейт ([ADR-0024](./decisions/0024-cookie-consent-gate.md)); `/privacy` — страница согласия.
