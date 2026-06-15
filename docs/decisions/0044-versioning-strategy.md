# ADR-0044: Версионирование — версия продукта + версии фронта/бэка + commit

- Статус: принято (2026-06-10, реш. Elmir)
- Контекст: фаза 1, F7. В UI (футер публичной зоны, аккаунт-дропдаун `/app`,
  релиз-ноты) показываем версию. Версия была **захардкожена** (`appVersion:
  '1.0.0-beta'`, продублирована в двух `environment.*.ts`), не связана ни с одним
  `package.json` (`angular` = 0.0.0, `nest` = 0.0.1) и расходилась с релиз-нотой
  (`release-1.0.0`). Нужно решить: версию **чего** показываем и где её source of truth.

## Развилка (ToT) — что показывать

| Ветвь | Суть | Минус |
|---|---|---|
| **A. Версия продукта + (фронт·бэк·commit)** | заголовок — единая версия «Нормисов»; в скобках — диагностика | чуть больше плумбинга (env + endpoint) |
| B. Фронт и бэк раздельно | две версии из package.json | не маппится на «Нормисы 1.0», двусмысленно |
| C. Версия бэка через runtime-API | бэк отдаёт свою версию | это «версия бэка», не продукта |

## Решение

**Ветвь A** (реш. Elmir). Показываем **версию продукта** «Нормисы» как заголовок, а
в скобках — диагностику: версия фронта · версия бэка · git-SHA. Источники истины:

- **Версия продукта** — в `.env` (`PRODUCT_VERSION`), единый source of truth. Фронт
  не читает `.env` (статический бандл), поэтому бэк отдаёт её в публичном
  `GET /api/v1/version`. Заодно честно показывает, **что реально развёрнуто**.
- **Версия бэка** — из `nest/package.json` (читается через `fs` в рантайме:
  `rootDir: src` без `resolveJsonModule` не даёт импортнуть JSON; util
  `readBackendVersion`, кэш, fallback `'0.0.0'`). Отдаётся в `GET /version`.
- **Версия фронта** — из `angular/package.json` (build-time `import { version }`,
  включён `resolveJsonModule`); кладётся в `environment.frontendVersion`.
- **commit** — короткий git-SHA. Приоритет: **env `GIT_COMMIT`** (прод — фикс на
  сборке, docker build ARG, D1) → если он задан, берём его; **иначе живое чтение
  `.git` HEAD** (dev — `.git` смонтирован ro, SHA отражает текущий `git checkout` и
  меняется сразу, без пересоздания контейнера). Нет ни env, ни `.git` → `''`.

Версии фронта и бэка **могут различаться** (деплой может быть рассинхронным) — потому
и показываем обе. `GET /version` = `{ product, backend, commit }`; фронт добавляет
свою `frontendVersion` и компонует строку: `Нормисы · vX  (front A · back B · sha)`.

## Последствия

- Бэк: `+PRODUCT_VERSION`, `+GIT_COMMIT` в env-схеме; `modules/version` (публичный
  `GET /version`); `readBackendVersion` (fs, кэш) + `readGitCommit` (живое чтение
  `.git`, без кэша). Релиз-сид F7 берёт `PRODUCT_VERSION`.
- Фронт: `resolveJsonModule: true`; `environment.frontendVersion`; `VersionService`
  (грузит `/version`, signal, computed `product`/`diagnostics`); футер + дропдаун.
- **Dev (live-отражение исходника):** в `docker-compose.dev.yml` для nest примонтированы
  ro `${PROJECT_ROOT}/.git` (commit текущего checkout) и `nest/package.json` (версия
  бэка без rebuild); для angular — `angular/package.json` (версия фронта без rebuild).
  Иначе значения брались бы из запечённых в образ копий (bind-mount только `src/`).
- **D1 (прод):** прокинуть `GIT_COMMIT` в прод-сборку (docker build ARG `git rev-parse
  --short HEAD` → env контейнера). В проде `.git` нет — commit берётся только из env.
- `angular`/`nest` `package.json` подняты до `1.0.0` под релиз 1.0 (дальше могут
  расходиться независимо).
- Старое поле `environment.appVersion` удалено (дубль убран).

## Пересмотр (2026-06-15, реш. Elmir)

Три версии (продукт · фронт · бэк) на практике путали: фронт и бэк всё равно
держатся на `1.0.0` и по отдельности не несут смысла. **Упростили до ОДНОЙ значимой
версии — продукта.**

- **Источник истины — файл `VERSION` в корне репо** (коммитимый; бамп = обычный
  коммit, версия в git-истории, одно место для всех сред). Был `.env` `PRODUCT_VERSION`
  (gitignored, бампился руками на сервере) — убран из env-схемы и всех `.env*`.
- **Версии фронта/бэка зафиксированы на `1.0.0`** и больше не вычисляются/не
  показываются. Убрано: `readBackendVersion` (fs-чтение `nest/package.json`),
  `environment.frontendVersion` (+ build-time import версии), dev-монтирования обоих
  `package.json`. `resolveJsonModule` в `angular/tsconfig.json` оставлен (безвреден).
- **`GET /version` = `{ product, commit }`** (поле `backend` убрано). Бэк читает
  `VERSION` через `readProductVersion` (fs, кэш, fallback `'0.0.0'`); путь —
  `process.cwd()/VERSION` (прод: `COPY VERSION ./VERSION`; dev: bind-mount
  `${PROJECT_ROOT}/VERSION:/app/VERSION:ro`).
- **UI:** футер/дропдаун — «Нормисы · v{product}» + `commit` как диагностика (front·back
  больше не показываем). `commit`-механика (env `GIT_COMMIT` ⟶ иначе живое чтение
  `.git`) — без изменений.
