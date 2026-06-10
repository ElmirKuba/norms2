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
- **commit** — короткий git-SHA, env `GIT_COMMIT`; **инжектится при сборке/деплоя**
  (D1: docker build ARG → env). В dev пусто → в выводе опускается.

Версии фронта и бэка **могут различаться** (деплой может быть рассинхронным) — потому
и показываем обе. `GET /version` = `{ product, backend, commit }`; фронт добавляет
свою `frontendVersion` и компонует строку: `Нормисы · vX  (front A · back B · sha)`.

## Последствия

- Бэк: `+PRODUCT_VERSION`, `+GIT_COMMIT` в env-схеме; `modules/version` (публичный
  `GET /version`); `readBackendVersion` util. Релиз-сид F7 берёт `PRODUCT_VERSION`.
- Фронт: `resolveJsonModule: true`; `environment.frontendVersion`; `VersionService`
  (грузит `/version`, signal, computed `product`/`diagnostics`); футер + дропдаун.
- **D1:** прокинуть `GIT_COMMIT` в прод-сборку (docker build ARG `git rev-parse
  --short HEAD` → env контейнера) — тогда в UI появится SHA. До этого commit пуст.
- `angular`/`nest` `package.json` версии (0.0.0 / 0.0.1) — поднять под реальный релиз
  отдельным решением (редакторская правка, на усмотрение Elmir).
- Старое поле `environment.appVersion` удалено (дубль убран).
