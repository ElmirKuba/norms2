# frontend.md — правила работы в `angular/`

> Реализация фронтенда (SPA). Конвенции — [ADR-0020](./decisions/0020-api-conventions.md) (токены), [ADR-0021](./decisions/0021-tooling-defaults.md) (тулинг). API — [`api-contracts.md`](./api-contracts.md).

## Стек
Angular latest stable (≥17), **standalone-компоненты**, **Signals** (+ поля класса, rxjs где нужно — **без стейт-менеджеров/NgRx**, [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)), **чистый SCSS/CSS** (без Tailwind/Bootstrap — свои лёгкие компоненты). **Angular Material — только `MatDialog`** для модалок ([ADR-0025](./decisions/0025-ui-ux-design-language.md)). TypeScript strict, **npm**.

## Структура
```
angular/src/app/
├─ core/            # кросс-срез: api-сервисы, interceptors, guards, auth-стор, util generateId()
├─ features/        # lazy-loaded фичи
│   ├─ auth/        # login, register, recover
│   ├─ profile/     # my-profile, user-profile/:login
│   ├─ invites/     # my-invites (создать/отозвать, список приглашённых)
│   ├─ bans/        # действие «забанить» в карточке приглашённого
│   ├─ sessions/    # список устройств, kick
│   └─ settings/    # секретные вопросы + recovery-required-count
├─ shared/          # переиспользуемые UI-компоненты (без Material)
└─ app.routes.ts    # lazy-маршруты
```

## Инициализация и feature-flags
- На старте (`APP_INITIALIZER`) — `GET /feature-flags`. Результат в сигнал-стор.
- Если `freeRegistration=false` → кнопка «Регистрация» ведёт на экран «система для своих, введите код»; без сабмит-кнопки — при вводе кода `XXXX-XXXX-XX` фронт сам зовёт `POST /invites/check`, валидный код держит в сервисе и прикладывает к `register` ([ADR-0010](./decisions/0010-registration-auth-flow.md)).

## Аутентификация (HTTP-слой)
- **Access-токен — в памяти** (Signal в `core/auth`), не в localStorage. **Refresh — httpOnly cookie** (JS не видит) ([ADR-0020](./decisions/0020-api-conventions.md)).
- Interceptor: подставляет `Authorization: Bearer` из сигнала; на `401` → `POST /auth/refresh` (cookie) → повтор запроса; refresh не удался → редирект на login.
- После `register` токенов нет → редирект на login ([ADR-0010](./decisions/0010-registration-auth-flow.md)).
- Guard на защищённые маршруты: пускает только при наличии валидного access/refresh.

## Формы и валидация
- Reactive forms; правила-зеркало к backend (login `^[a-zA-Z0-9_]{3,32}$`, alias 2–32, и т.д. — [ADR-0006](./decisions/0006-registration-field-rules.md)). Серверная валидация — источник истины, клиентская — UX.
- Ошибки API (`{error:{code,message}}`) маппятся в человекочитаемые сообщения по `code`.

## Состояние
- **Signals + обычные поля класса**; rxjs/сервисы — только где реально нужно (async-потоки). **Без стейт-менеджеров (NgRx и любых) — категорически** (предпочтение Elmir, [ADR-0030](./decisions/0030-stack-revision-drizzle-5layer-npm.md)). Без глобального store-фреймворка.

## Типы и интерфейсы ([ADR-0033](./decisions/0033-type-hierarchy-convention.md))
- Та же иерархия, что на бэке: `XxxPure → XxxBase extends XxxPure → XxxFull extends Required<XxxBase>`; «виды» — утилитами (`XxxCreate`, `XxxUpdate = Pick<XxxFull,'id'> & Partial<XxxBase>`, `XxxRead = Omit<XxxFull, секреты>`). Каждое свойство — в одном месте; не переобъявлять, только `extends`/`Pick`/`Omit`/`Required`/`Partial`.
- Имена: суффикс роли, **без** `I`-префикса; PK `id`, FK `xxxId` (тип `string`).
- Типы **не шарятся** с бэком (монорепо без workspace): фронт держит в `core/interfaces/<entity>/` своё **зеркало подмножества** контракта (обычно `Read`/`Create`/`Update`), которое реально нужно UI. Источник истины формы — бэк; рассинхрон ловится на интеграции.

## Идентификаторы
- util `generateId()` (`core/utils/generate-id.util.ts`; формат `uuidv7___unixmillis`, [ADR-0016](./decisions/0016-primary-key-format.md)) — **параллельная копия** бэковой (типы/утилы фронта и бэка не шарятся); без зависимостей; для случаев, когда id нужен на клиенте.

## Восстановление (UI)
- Настройки: добавить/удалить вопросы, выбрать `recovery_required_count` (K). Баннер-напоминание «настройте восстановление, иначе потеряете доступ» ([ADR-0008](./decisions/0008-account-recovery-secret-questions.md)).
- Флоу восстановления: `login` → показ K случайных вопросов → ответы → новый пароль.
- Деактивация/удаление аккаунта — в настройках; флоу реактивации при входе ([ADR-0017](./decisions/0017-account-soft-delete.md)).

## Предупреждения про ПДн
- На полях `reason` (инвайт/бан) и «свой вопрос» — подсказка «не указывайте реальные имена/телефоны/адреса».

## i18n
- Фаза 1 — русский. Структура под i18n заложена; мультиязычность — открытый пункт A3 (решаем позже).

## Дизайн
- Дизайн-язык, токены (SCSS-переменные), экраны и тон — в [`ui-ux.md`](./ui-ux.md).
- Стили — SCSS, тема через CSS-переменные.

## Модальная система ([ADR-0026](./decisions/0026-modal-system.md))
Единственное использование Angular Material — `MatDialog`. Воспроизводим конфигурируемый паттерн на Angular 17+ (standalone, `inject`, `@if`):
- **Универсальный `DialogModalComponent`** (рамка) для ~80% случаев, конфиг через **`DialogModalData<T>`** (title, иконка, `text` или `component`+`componentData`, `isConfirmModal`, колбеки confirm/cancel/close — **sync и async**, layout кнопок, `preventDialogClose`). Композиция: `modal-header`/`modal-content`/`modal-footer`.
- **Standalone-компонент напрямую** для ~20% (полноэкранные/мультишаговые).
- **Sync колбек** → `mat-dialog-close` (авто-закрытие); **async** → ручной `ref.close()`.
- Вложение компонента — `NgComponentOutlet`.
- **5 паттернов результата:** void; `afterClosed()` Observable; `firstValueFrom` Promise; `new Promise` + sync-колбеки; `MatDialogRef` (закрыть позже, спиннер).
- **Доменные modal-сервисы** на модуль прячут конфиг за методами (`confirmDelete()`, `showError()`, `openLoading()`).
- Константы/пресеты размеров для единообразия.
- Полный референс (контракт, код, partials, паттерны, схема) — [`sections/_shared/modal-system.md`](./sections/_shared/modal-system.md).
