import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

/** Данные спиннер-модалки. */
export interface SpinnerModalData {
  /** Заголовок. */
  title: string;
  /** Текст. */
  text: string;
}

/**
 * Спиннер-модалка ожидания (Способ 5): открывается и закрывается извне
 * (`const ref = modal.openLoading(...); await op(); ref.close();`).
 */
@Component({
  selector: 'app-spinner-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrapper">
      <div class="spinner"></div>
      <div class="title" [innerHTML]="data.title"></div>
      <div class="text" [innerHTML]="data.text"></div>
    </div>
  `,
  styles: [
    `
      .wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-2);
        padding: var(--space-4);
      }
      .spinner {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-accent);
        animation: spinner-spin 0.8s linear infinite;
        margin-bottom: var(--space-2);
      }
      .title {
        font-weight: var(--fw-bold);
      }
      .text {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      @keyframes spinner-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SpinnerModalComponent {
  /** Данные (заголовок/текст). */
  public readonly data = inject<SpinnerModalData>(MAT_DIALOG_DATA);
}
