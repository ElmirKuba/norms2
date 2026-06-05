import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { MatDialogRef } from '@angular/material/dialog';
import { DialogModalComponent } from './dialog-modal/dialog-modal.component';
import { ModalHeaderClassIcon } from './dialog-modal/dialog-modal.types';
import type { DialogModalData } from './dialog-modal/dialog-modal.types';
import { SpinnerModalComponent } from './spinner-modal/spinner-modal.component';
import { MODAL_SMALL_WIDTH, spinnerModalParams } from './modals.constants';

/** Опции подтверждающей модалки. */
export interface ConfirmOptions {
  /** Заголовок. */
  title: string;
  /** Текст (опц.). */
  text?: string;
  /** Подпись кнопки подтверждения (по умолчанию «Да»). */
  confirmText?: string;
  /** Подпись кнопки отмены (по умолчанию «Нет»). */
  cancelText?: string;
  /** Опасное действие — иконка warning + красная кнопка. */
  danger?: boolean;
}

/**
 * Базовый сервис модалок над `MatDialog` (ADR-0026): общие confirm / сообщения /
 * спиннер. Доменные сервисы (инвайты, баны, …) добавляются в своих фичах поверх.
 * Компоненты не дёргают `MatDialog` напрямую.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly _dialog = inject(MatDialog);

  /**
   * Подтверждение (паттерн 4: Promise + sync-колбеки).
   * @param options Опции.
   * @returns true — подтверждено, false — отменено/закрыто.
   */
  public confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const data: DialogModalData = {
        isConfirmModal: true,
        title: options.title,
        ...(options.text === undefined ? {} : { text: options.text }),
        textCenter: true,
        classIcon: options.danger ? ModalHeaderClassIcon.Warning : ModalHeaderClassIcon.Info,
        isButtonsOrderReversed: true,
        confirmBtnText: options.confirmText ?? 'Да',
        cancelBtnText: options.cancelText ?? 'Нет',
        confirmBtnDanger: options.danger ?? false,
        confirmCallback: () => resolve(true),
        cancelCallback: () => resolve(false),
      };
      const ref = this._dialog.open(DialogModalComponent, {
        width: MODAL_SMALL_WIDTH,
        disableClose: true,
        data,
      });
      // Закрытие крестиком/иначе без выбора — трактуем как отмену.
      ref.afterClosed().subscribe(() => resolve(false));
    });
  }

  /**
   * Информационное/успешное/ошибочное сообщение (паттерн 1).
   * @param title Заголовок.
   * @param icon Иконка статуса.
   * @param text Текст (опц.).
   */
  public message(title: string, icon: ModalHeaderClassIcon, text?: string): void {
    const data: DialogModalData = {
      title,
      classIcon: icon,
      textCenter: true,
      ...(text === undefined ? {} : { text }),
    };
    this._dialog.open(DialogModalComponent, { width: MODAL_SMALL_WIDTH, data });
  }

  /** Сообщение об успехе. */
  public success(title: string, text?: string): void {
    this.message(title, ModalHeaderClassIcon.Done, text);
  }

  /** Сообщение об ошибке. */
  public error(title: string, text?: string): void {
    this.message(title, ModalHeaderClassIcon.Error, text);
  }

  /**
   * Спиннер ожидания (паттерн 5): закрыть результат вызывающему через `ref.close()`.
   * @param title Заголовок.
   * @param text Текст.
   * @returns Ref модалки.
   */
  public openLoading(title: string, text = ''): MatDialogRef<SpinnerModalComponent> {
    return this._dialog.open(SpinnerModalComponent, spinnerModalParams(title, text));
  }
}
