# ADR-0026: Модальная система (MatDialog, конфигурируемый shell)

- **Статус:** accepted
- **Дата:** 2026-05-30
- **Решает:** Elmir (исключение из [ADR-0025](./0025-ui-ux-design-language.md) — единственное Material в проекте)
- **Контекст-теги:** [frontend] [ux]
- **Источник:** паттерн из прод-проекта Elmir (Angular 12), воспроизводим на 17+. **Полное описание (контракт, код, partials, паттерны, схема) перенесено В РЕПО:** [`sections/_shared/modal-system.md`](../sections/_shared/modal-system.md) — внешний файл больше не нужен.

## Контекст
Весь UI — свои компоненты на SCSS ([ADR-0025](./0025-ui-ux-design-language.md)). Исключение — модалки: берём `MatDialog` как готовый надёжный механизм и воспроизводим проверенный конфигурируемый паттерн.

## Решение (принципы, переносимые на Angular 17+ standalone)
- **Только `MatDialog`** из `@angular/material` (тянет `@angular/cdk`). Больше Material нигде.
- **Два способа открытия:**
  - **A (≈80%)** — универсальный `DialogModalComponent` (рамка), конфигурируемый через `DialogModalData<T>`.
  - **B (≈20%)** — самостоятельный standalone-компонент открывается напрямую (полноэкранные/мультишаговые), сам управляет layout.
- **Композиция рамки** — partial-компоненты `modal-header` / `modal-content` / `modal-footer`.
- **`DialogModalData<T>`** — единый типизированный контракт: `title`, иконка (`classIcon`: done/error/info/warning/preloader), `text` (innerHTML) **или** `component`+`componentData`, `isConfirmModal`, тексты/колбеки кнопок confirm/cancel/close (**sync и async**), layout кнопок, `preventDialogClose`, `isConfirmButtonDisabled`, data-test атрибуты.
- **Sync vs async колбеки:** sync — кнопка с `mat-dialog-close` (закрытие авто); async — без него, закрытие вручную `ref.close()` (дождаться API/спиннер).
- **Вложение компонента** — через `NgComponentOutlet` (современная замена CDK Portal).
- **5 паттернов результата:** void (fire-and-forget); `Observable` через `afterClosed()`; `Promise` через `firstValueFrom`; `Promise` через `new Promise` + sync-колбеки (частый для confirm); `MatDialogRef` напрямую (закрыть позже — спиннер).
- **Доменные modal-сервисы** — на модуль; прячут конфиг за осмысленными методами (`confirmDelete()`, `showError()`, `openLoading()`).
- **Константы/пресеты** размеров (small/medium/large/fullscreen) для единообразия.
- Современный синтаксис: `standalone: true`, `inject(MAT_DIALOG_DATA)`, control flow `@if`.

## Последствия
- Зависимость `@angular/material` — оправдана только модалками.
- **Полная реализация и все механизмы — [`sections/_shared/modal-system.md`](../sections/_shared/modal-system.md)** (самодостаточно, не зависит от внешних файлов). Этот ADR — краткое «почему», тот док — «как».
