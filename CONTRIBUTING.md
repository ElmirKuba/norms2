# Контрибьютинг в «Нормисы»

Спасибо за интерес! «Нормисы» — открытый некоммерческий проект «для своих»,
нацеленный на развитие участников и **разработчиков**. Мы рады форкам, идеям и PR.

## Лицензия и атрибуция

- Проект под лицензией **Apache-2.0** (см. [`LICENSE`](./LICENSE)).
- Отправляя Contribution, вы соглашаетесь, что он включается в проект на условиях
  Apache-2.0 (§5 лицензии) — без отдельного CLA.
- Атрибуция первичных авторов сохраняется в [`NOTICE`](./NOTICE). Если вы развиваете
  форк или делаете значимый вклад — **впишите себя** в список контрибьюторов (в
  `NOTICE` и/или ниже), сохранив указание на первичных авторов.

## Как развернуть локально

Нужен Docker. Из корня репозитория:

```bash
make dev-rebuild     # postgres + pgadmin + nest + angular (watch)
make db-migrate      # накатить миграции Drizzle
```

Подробнее — в [`docs/getting-started.md`](./docs/getting-started.md) и
[`docs/deployment.md`](./docs/deployment.md). Карта документации — в
[`README.md`](./README.md) и [`docs/`](./docs/).

## Конвенции кода (коротко)

Полные правила — в [`CLAUDE.md`](./CLAUDE.md). Самое важное:

- **Backend (NestJS):** 5-слойная архитектура — `controllers → use-cases →
  domain-services → adapters(порты) → repositories`. Кросс-домен — только вниз.
  ORM (Drizzle) — только в `database/`; бизнес-слои зависят от портов, не от
  конкретной инфры.
- **Frontend (Angular):** standalone-компоненты, Signals (без NgRx), чистый SCSS
  (без Tailwind), `OnPush`, внешние `.html`/`.scss` (без inline-шаблонов).
- **TypeScript:** без `any` (используйте `unknown` + сужение).
- **Без ПДн** в БД и UI (152-ФЗ) — псевдонимы и логины.
- **Дока = факт:** меняете поведение/контракт — обновите связанные `.md`
  (`docs/api-contracts.md` и пр.) в том же заходе.
- **Архитектурная развилка → ADR** в [`docs/decisions/`](./docs/decisions/).

## Процесс

1. Форкните репозиторий и создайте ветку от `main`.
2. Делайте небольшие связные коммиты (Conventional Commits: `feat`/`fix`/`docs`/
   `chore`/`test`/`refactor`/`style` + скоуп).
3. Убедитесь, что собирается: `cd nest && npx tsc --noEmit` и `cd angular && npm run build`.
4. Откройте Pull Request в основной проект с понятным описанием.

## Контакты

Вопросы и обсуждения — GitHub Issues или Telegram **@elmir_kuba**.

## Контрибьюторы

- Elmir Kuba (https://github.com/ElmirKuba) — автор проекта.
<!-- Добавляйте себя сюда в PR: - Имя (ссылка) — краткое описание вклада. -->
