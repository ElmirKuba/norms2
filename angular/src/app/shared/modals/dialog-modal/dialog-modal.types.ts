import type { Type } from '@angular/core';

/** Готовые иконки шапки модалки (CSS-рисованные, без ассетов). */
export enum ModalHeaderClassIcon {
  Preloader = 'preloader',
  Done = 'done',
  Error = 'error',
  Info = 'info',
  Warning = 'warning',
}

/**
 * Контракт универсальной рамки `DialogModalComponent` (ADR-0026). Конфиг через
 * `data` покрывает ~80% модалок: заголовок+иконка, текст ИЛИ вложенный компонент,
 * кнопки (confirm/cancel или одна «Закрыть»), sync/async-колбеки, layout, поведение.
 */
export interface DialogModalData<T = unknown> {
  // — Заголовок —
  readonly title?: string;
  readonly classIcon?: ModalHeaderClassIcon;

  // — Контент —
  readonly text?: string;
  readonly textCenter?: boolean;
  readonly component?: Type<unknown>;
  readonly componentData?: T;

  // — Режим —
  readonly isConfirmModal?: boolean;

  // — Confirm —
  readonly confirmBtnText?: string;
  readonly confirmCallback?: () => void;
  readonly confirmCallbackAsync?: () => Promise<void>;
  readonly isConfirmButtonDisabled?: () => boolean;
  readonly confirmBtnDanger?: boolean;

  // — Cancel —
  readonly cancelBtnText?: string;
  readonly cancelCallback?: () => void;
  readonly cancelCallbackAsync?: () => Promise<void>;

  // — Close (не-confirm) —
  readonly closeBtnText?: string;
  readonly closeCallback?: () => void;
  readonly isAccentCloseBtn?: boolean;

  // — Layout кнопок —
  readonly isFooterButtonsVertically?: boolean;
  readonly isButtonsOrderReversed?: boolean;

  // — Поведение —
  readonly preventDialogClose?: boolean;
}
