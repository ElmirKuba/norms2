# Модальная система (общая для всех разделов)

> Полное, **самодостаточное** описание модальной системы Нормисов: контракт, реализация на Angular 17+, partials, паттерны результата, доменные сервисы, схема потока. Решение — [ADR-0026](../../decisions/0026-modal-system.md). Это **единственный источник истины** по модалкам (исходный анализ перенесён сюда целиком; внешний файл больше не нужен).
>
> **Стек Нормисов:** Angular standalone + Signals, **чистый SCSS** (без Tailwind), `inject()`, control-flow `@if`, `NgComponentOutlet`. Единственное использование Angular Material во всём проекте — **`MatDialog`** ([ADR-0025](../../decisions/0025-ui-ux-design-language.md)).

## 1. Общая идея

Система построена на `MatDialog`. **Два способа** открытия:

- **Способ A (≈80%) — Shell + конфиг.** Открываем универсальную рамку `DialogModalComponent`, через `data: DialogModalData<T>` задаём что внутри: заголовок, иконку, текст или целый компонент, кнопки.
  ```ts
  this.dialog.open<DialogModalComponent, DialogModalData>(DialogModalComponent, {
    width: MODAL_SMALL_WIDTH,
    data: { title: 'Заголовок', text: 'Текст', classIcon: ModalHeaderClassIcon.Done },
  });
  ```
- **Способ B (≈20%) — самостоятельный standalone-компонент напрямую** (полноэкранные формы, мультишаговые сценарии, кроп аватара): сам управляет layout/кнопками.
  ```ts
  this.dialog.open(AvatarCropComponent, { ...FULL_SCREEN_MODAL_PARAMS, disableClose: true, data });
  ```

## 2. Структура файлов (в `angular/.../shared/modals/`)

```
shared/modals/
├── dialog-modal/                 ← универсальная рамка (Способ A)
│   ├── dialog-modal.component.ts
│   └── dialog-modal.component.scss
├── spinner-modal/                ← спиннер ожидания
│   └── spinner-modal.component.ts
├── partials/                     ← переиспользуемые части рамки
│   ├── modal-header/
│   ├── modal-content/
│   └── modal-footer/
├── modals.constants.ts           ← размеры, пресеты, фабрики
└── (доменные modal-сервисы живут в своих feature-папках)
```
Всё standalone — `modals.module.ts` не нужен.

## 3. Контракт `DialogModalData<T>` — сердце системы

```ts
export interface DialogModalData<T = unknown> {
  // — Заголовок —
  readonly title?: string;
  readonly svgIcon?: SvgIcon;                 // своя SVG-иконка
  readonly classIcon?: ModalHeaderClassIcon;  // done|error|info|warning|preloader

  // — Контент —
  readonly text?: string;                     // текст/HTML (через [innerHTML])
  readonly textCenter?: boolean;
  readonly component?: Type<unknown>;         // произвольный компонент вместо текста
  readonly componentData?: T;                 // generic-данные для него

  // — Режим —
  readonly isConfirmModal?: boolean;          // true → confirm+cancel; false → одна «Закрыть»

  // — Confirm —
  readonly confirmBtnText?: string;           // по умолчанию «Да»
  readonly confirmCallback?: () => void;            // SYNC — закроется автоматически
  readonly confirmCallbackAsync?: () => Promise<void>; // ASYNC — НЕ закроется, ref.close() вручную
  readonly isConfirmButtonDisabled?: () => boolean;    // динамическая блокировка
  readonly confirmBtnDataAttr?: string;       // data-test для e2e

  // — Cancel —
  readonly cancelBtnText?: string;            // по умолчанию «Нет»
  readonly cancelCallback?: () => void;
  readonly cancelCallbackAsync?: () => Promise<void>;
  readonly cancelBtnDataAttr?: string;

  // — Close (не-confirm режим) —
  readonly closeBtnText?: string;             // по умолчанию «Закрыть»
  readonly closeCallback?: () => void;
  readonly isAccentCloseBtn?: boolean;

  // — Layout кнопок —
  readonly isFooterButtonsVertically?: boolean;
  readonly isButtonsOrderReversed?: boolean;
  readonly footerClass?: string;

  // — Поведение —
  readonly preventDialogClose?: boolean;      // блок Escape и клика по backdrop
  readonly dataTest?: string;
}

export enum ModalHeaderClassIcon {
  Preloader = 'preloader', // крутилка
  Done = 'done',           // зелёная галочка
  Error = 'error',         // красный крест
  Info = 'info',           // синяя инфо
  Warning = 'warning',     // жёлтый треугольник
}
```

## 4. `DialogModalComponent` (Angular 17+, standalone)

```ts
@Component({
  standalone: true,
  selector: 'dialog-modal',
  imports: [MatDialogModule, NgComponentOutlet, ModalHeaderComponent, ModalContentComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.Default, // НЕ OnPush — колбеки могут менять состояние извне
  template: `
    <modal-header [classIcon]="data.classIcon" [svgIcon]="data.svgIcon" [textCenter]="!!data.textCenter">
      <span [innerHTML]="data.title"></span>
    </modal-header>

    @if (data.text || data.component) {
      <modal-content>
        @if (data.text; as text) {
          <div [class.text-center]="data.textCenter" [innerHTML]="text"></div>
        } @else if (data.component) {
          <ng-container *ngComponentOutlet="data.component; inputs: { data: data.componentData }" />
        }
      </modal-content>
    }

    <modal-footer [vertically]="!!data.isFooterButtonsVertically"
                  [reversed]="!!data.isButtonsOrderReversed"
                  [footerClass]="data.footerClass">
      @if (data.isConfirmModal) {
        <button (click)="onConfirm()" [disabled]="isConfirmDisabled()"
                [attr.data-test]="data.confirmBtnDataAttr">{{ data.confirmBtnText || 'Да' }}</button>
        <button class="not-accent-button" (click)="onCancel()"
                [attr.data-test]="data.cancelBtnDataAttr">{{ data.cancelBtnText || 'Нет' }}</button>
      } @else {
        <button [class.not-accent-button]="!data.isAccentCloseBtn" (click)="onClose()">
          {{ data.closeBtnText || 'Закрыть' }}
        </button>
      }
    </modal-footer>
  `,
})
export class DialogModalComponent<T = unknown> {
  readonly data = inject<DialogModalData<T>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DialogModalComponent<T>>);

  constructor() {
    if (this.data.preventDialogClose) {
      this.dialogRef.disableClose = true;
      this.dialogRef.backdropClick().subscribe(() => false);
      this.dialogRef.keydownEvents().subscribe((e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
      });
    }
  }

  async onConfirm(): Promise<void> {
    if (this.data.confirmCallbackAsync) { await this.data.confirmCallbackAsync(); /* колбек сам закроет */ }
    else { this.data.confirmCallback?.(); this.dialogRef.close(true); }
  }
  async onCancel(): Promise<void> {
    if (this.data.cancelCallbackAsync) { await this.data.cancelCallbackAsync(); }
    else { this.data.cancelCallback?.(); this.dialogRef.close(false); }
  }
  onClose(): void { this.data.closeCallback?.(); this.dialogRef.close(); }
  isConfirmDisabled(): boolean { return this.data.isConfirmButtonDisabled?.() ?? false; }
}
```

> **Вложение компонента:** `NgComponentOutlet` рендерит `data.component`, прокидывая `componentData` как input `data`. (Альтернатива из исходника — CDK `ComponentPortal` + `onAttach` для доступа к `ComponentRef`; на 17+ `NgComponentOutlet` проще, берём его.)

## 5. Partials (standalone, OnPush)

**modal-header** — иконка (SVG или CSS-класс) + заголовок:
```ts
@Component({ standalone: true, selector: 'modal-header', imports: [MatDialogModule, /*SvgIcon*/],
  changeDetection: ChangeDetectionStrategy.OnPush, template: `
  @if (svgIcon; as icon) { <app-svg-icon [name]="icon.name" [size]="icon.size || 44" [color]="icon.color"/> }
  @else if (classIcon) { <div [class]="['class-icon', classIcon]"></div> }
  <h2 mat-dialog-title [class.text-center]="textCenter"><ng-content/></h2>` })
export class ModalHeaderComponent {
  @Input() svgIcon?: SvgIcon; @Input() classIcon?: ModalHeaderClassIcon; @Input() textCenter = false;
}
```
SCSS иконок (через CSS-переменные темы, [ADR-0025](../../decisions/0025-ui-ux-design-language.md)):
```scss
:host { display:flex; flex-direction:column; align-items:center; text-align:center; }
.class-icon { width:44px; height:44px; margin-bottom:16px;
  &.preloader { /* анимированная крутилка */ }
  &.done    { mask-image:url('...done.svg');    background:var(--color-positive); }
  &.error   { mask-image:url('...error.svg');   background:var(--color-negative); }
  &.info    { mask-image:url('...info.svg');    background:var(--color-active); }
  &.warning { mask-image:url('...warning.svg'); background:var(--color-warning); }
}
h2 { margin:0; line-height:24px; }
```

**modal-content** — обёртка над `mat-dialog-content`:
```ts
@Component({ standalone:true, selector:'modal-content', imports:[MatDialogModule],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<mat-dialog-content><ng-content/></mat-dialog-content>` })
export class ModalContentComponent {}
```

**modal-footer** — раскладка кнопок:
```ts
@Component({ standalone:true, selector:'modal-footer', imports:[MatDialogModule],
  changeDetection:ChangeDetectionStrategy.OnPush, template:`
  <mat-dialog-actions [class.vertically]="vertically" [class.reverse]="reversed" [class]="footerClass">
    <ng-content/>
  </mat-dialog-actions>` })
export class ModalFooterComponent {
  @Input() vertically=false; @Input() reversed=false; @Input() footerClass?: string;
}
```
```scss
mat-dialog-actions { min-height:0; margin:0; padding:0; display:flex;
  button { flex:1 1 0; &:not(:only-child):first-child { margin:0 10px 0 0; } }
  &.reverse { flex-direction:row-reverse;
    button:not(:only-child):first-child { margin:0 0 0 10px; } }
  &.vertically { flex-direction:column;
    button { margin:10px 0 0 0 !important; }
    &.reverse { flex-direction:column-reverse; } }
}
```

## 6. `SpinnerModalComponent` (вторая рамка — ожидание)

```ts
export interface SpinnerModalData { title: string; text: string; }

@Component({ standalone:true, selector:'spinner-modal', changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<div class="wrapper">
    <div class="class-icon preloader"></div>
    <div class="title" [innerHTML]="data.title"></div>
    <div class="text"  [innerHTML]="data.text"></div>
  </div>` })
export class SpinnerModalComponent { readonly data = inject<SpinnerModalData>(MAT_DIALOG_DATA); }
```
Открывается и закрывается **извне** (паттерн 5): `const ref = svc.openLoading(); await op(); ref.close();`.

## 7. Константы и пресеты (`modals.constants.ts`)

```ts
export const MODAL_SMALL_WIDTH = '440px';
export const MODAL_MEDIUM_WIDTH = '700px';
export const MODAL_LARGE_WIDTH = '770px';
export const MODAL_EXTRA_LARGE_WIDTH = '1000px';
export const MODAL_THREE_QUARTER = '75%';
export const MODAL_VIEWPORT_MAX_WIDTH = 'calc(100vw - 32px)';
export const MODAL_VIEWPORT_MAX_HEIGHT = 'calc(100vh - 32px)';

export const FULL_SCREEN_MODAL_PARAMS = {
  width:'100%', maxWidth:'100%', height:'100%',
  panelClass:['no-border-modal','no-padding-modal'], data:{},
};
export const spinnerModalParams = (title: string, text: string) => ({
  data:{ title, text }, width: MODAL_SMALL_WIDTH, disableClose: true,
});
```

## 8. Пять паттернов возврата результата

1. **Fire-and-forget (void)** — показать и забыть:
   ```ts
   this.dialog.open(DialogModalComponent, { width:MODAL_SMALL_WIDTH,
     data:{ title:'Готово', classIcon:ModalHeaderClassIcon.Done, textCenter:true } });
   ```
2. **Observable через `afterClosed()`:**
   ```ts
   return this.dialog.open(SelectActionComponent, { width:MODAL_SMALL_WIDTH }).afterClosed();
   ```
3. **Promise через `firstValueFrom`:**
   ```ts
   return firstValueFrom(this.dialog.open<C, void, R>(C, { disableClose:true }).afterClosed());
   ```
4. **Promise через `new Promise` + sync-колбеки** (самый частый для confirm; кнопка с авто-закрытием):
   ```ts
   confirmDelete(title: string): Promise<boolean> {
     return new Promise((resolve) => {
       this.dialog.open<DialogModalComponent, DialogModalData>(DialogModalComponent, {
         width:MODAL_SMALL_WIDTH, disableClose:true,
         data:{ isConfirmModal:true, classIcon:ModalHeaderClassIcon.Warning, title,
           text:'Это действие необратимо', textCenter:true, isButtonsOrderReversed:true,
           confirmBtnText:'Удалить', confirmCallback:()=>resolve(true),
           cancelBtnText:'Отмена',  cancelCallback:()=>resolve(false) } });
     });
   }
   ```
5. **`MatDialogRef` напрямую** (ручное закрытие позже — спиннер): см. §6.

## 9. Sync vs Async колбеки (ключевое отличие)

| | Sync (`confirmCallback`) | Async (`confirmCallbackAsync`) |
|---|---|---|
| Закрытие | автоматически после клика | вручную: `ref.close()` в колбеке |
| Когда | простое действие | дождаться API, показать спиннер, повторить |

Async-пример (повтор/закрытие с результатом):
```ts
const ref = this.dialog.open<DialogModalComponent, DialogModalData, boolean>(DialogModalComponent, {
  width:MODAL_SMALL_WIDTH, disableClose:true,
  data:{ title:'Не отвечает', classIcon:ModalHeaderClassIcon.Error, isConfirmModal:true,
    confirmBtnText:'Повторить', cancelBtnText:'Закрыть',
    confirmCallbackAsync: async () => ref.close(true),
    cancelCallbackAsync:  async () => ref.close(false) } });
return ref.afterClosed();
```

## 10. Доменные modal-сервисы

Каждый feature прячет конфиг за осмысленными методами (не дёргает `MatDialog` напрямую из компонентов):
```ts
@Injectable({ providedIn:'root' })
export class InviteModalService {
  private readonly dialog = inject(MatDialog);
  confirmRevoke(code: string): Promise<boolean> { /* паттерн 4 */ }
  showError(text: string): void { /* паттерн 1 */ }
  openLoading(title: string): MatDialogRef<SpinnerModalComponent> { /* паттерн 5 */ }
}
```

## 11. Схема потока данных

```
[доменный modal-сервис]
   │ dialog.open<Shell, Data, Result>(...)
   ▼
[MatDialog]
   ├─ Способ A: DialogModalComponent (рамка)
   │     ├─ <modal-header>  title + icon
   │     ├─ <modal-content> text(innerHTML) | NgComponentOutlet(component+componentData)
   │     └─ <modal-footer>  кнопки (sync/async колбеки)
   └─ Способ B: самостоятельный standalone-компонент (сам layout, data через MAT_DIALOG_DATA)
   ▼
ref.afterClosed() ──▶ Observable<Result> ──▶ Promise / subscribe / void
```

## 12. Принципы (что неизменно)

1. Один универсальный `DialogModalComponent` + конфиг через `data` (80% случаев).
2. Композиция header/content/footer — partials.
3. `DialogModalData<T>` — единый типизированный контракт.
4. Sync vs async колбеки — контроль над закрытием.
5. Доменные modal-сервисы — абстракция над `MatDialog`.
6. Константы размеров/пресеты — единообразие.
7. Два способа: shell+config (просто) / standalone-компонент (сложно).

## 13. Установка

```bash
ng add @angular/material   # CDK ставится вместе; используем ТОЛЬКО MatDialog
```
Остальной UI — свои компоненты на чистом SCSS ([ADR-0025](../../decisions/0025-ui-ux-design-language.md)). Источник паттерна — прод-проект Elmir (Angular 12), здесь адаптирован под Angular 17+ standalone.
