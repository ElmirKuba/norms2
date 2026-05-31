# ADR-0021: Тулинг и версии (дефолты)

- **Статус:** accepted — **частично заменён [ADR-0030](./0030-stack-revision-drizzle-5layer-npm.md):** пакетный менеджер **npm** (не pnpm), ORM **Drizzle** (не TypeORM), архитектура 5-слойная. Остальное (Node LTS, Jest, Signals-без-стора, latest Nest/Angular) — в силе.
- **Дата:** 2026-05-30
- **Решает:** рекомендации Claude, одобрено Elmir (пункты G2, G3, H1, H2)
- **Контекст-теги:** [backend] [frontend] [tooling]

## Решение
- **Пакетный менеджер:** ~~pnpm~~ → **npm** (заменено [ADR-0030](./0030-stack-revision-drizzle-5layer-npm.md): единообразие с проектами Elmir).
- **Node:** LTS ≥20.
- **NestJS:** latest stable (≥10). **Angular:** latest stable (≥17 как база) — **точная версия пинится при bootstrap** (не хардкодим число в доке, чтобы не устарело).
- **Тесты бэка:** Jest — unit на use-cases (порты замоканы) + e2e через supertest на тестовой БД.
- **Тесты фронта:** лёгкие unit (Jest/Vitest) на сервисы/логику; не гнаться за покрытием в фазе 1.
- **State фронта:** Angular **Signals**, **per-feature** хранилища; без глобального store-фреймворка.
- **Стили:** чистый SCSS/CSS (без Tailwind), свои компоненты; `MatDialog` (Angular Material) только для модалок — см. [ADR-0025](./0025-ui-ux-design-language.md). Дизайн-токены — SCSS-переменные в `ui-ux.md`.

## Альтернативы
- Karma — устаревает, не берём. (pnpm рассматривался, отвергнут в пользу npm — [ADR-0030](./0030-stack-revision-drizzle-5layer-npm.md).)

## Последствия
- `backend.md`, `frontend.md`, `getting-started.md` опираются на эти дефолты.
- «latest stable» зафиксировать конкретными версиями в `package.json` при инициализации проектов (отдельная запись не нужна — версии живут в lock-файлах).
