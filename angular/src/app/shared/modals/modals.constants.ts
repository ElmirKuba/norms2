import type { MatDialogConfig } from '@angular/material/dialog';
import type { SpinnerModalData } from './spinner-modal/spinner-modal.component';

/** Пресеты ширины модалок (единообразие, ADR-0026). */
export const MODAL_SMALL_WIDTH = '440px';
export const MODAL_MEDIUM_WIDTH = '640px';
export const MODAL_LARGE_WIDTH = '770px';
export const MODAL_VIEWPORT_MAX_WIDTH = 'calc(100vw - 32px)';
export const MODAL_VIEWPORT_MAX_HEIGHT = 'calc(100dvh - 32px)';

/** Параметры полноэкранной модалки (Способ B: кроп аватара и т.п.). */
export const FULL_SCREEN_MODAL_PARAMS = {
  width: '100%',
  maxWidth: '100%',
  height: '100%',
  panelClass: ['modal-fullscreen'],
} satisfies MatDialogConfig;

/**
 * Конфиг спиннер-модалки (Способ 5: открыть/закрыть извне).
 * @param title Заголовок.
 * @param text Текст.
 * @returns Конфиг MatDialog.
 */
export function spinnerModalParams(title: string, text: string): MatDialogConfig<SpinnerModalData> {
  return { data: { title, text }, width: MODAL_SMALL_WIDTH, disableClose: true };
}
