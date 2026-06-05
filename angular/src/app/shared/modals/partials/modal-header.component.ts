import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import type { ModalHeaderClassIcon } from '../dialog-modal/dialog-modal.types';

/**
 * Шапка модалки: CSS-рисованная иконка статуса (done/error/info/warning/preloader)
 * + заголовок (через `ng-content`). Без внешних ассетов.
 */
@Component({
  selector: 'app-modal-header',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (classIcon()) {
      <div class="class-icon {{ classIcon() }}"></div>
    }
    <h2 mat-dialog-title [class.center]="textCenter()"><ng-content /></h2>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .class-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        margin: 0 auto var(--space-3);
        color: #fff;
        font-weight: var(--fw-bold);
        font-size: 1.4rem;
        line-height: 1;
      }
      .class-icon.done {
        background: var(--color-success);
      }
      .class-icon.done::after {
        content: '✓';
      }
      .class-icon.error {
        background: var(--color-danger);
      }
      .class-icon.error::after {
        content: '✕';
      }
      .class-icon.info {
        background: var(--color-accent);
      }
      .class-icon.info::after {
        content: 'i';
        font-style: italic;
      }
      .class-icon.warning {
        background: var(--color-warning);
      }
      .class-icon.warning::after {
        content: '!';
      }
      .class-icon.preloader {
        background: transparent;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-accent);
        animation: modal-spin 0.8s linear infinite;
      }
      @keyframes modal-spin {
        to {
          transform: rotate(360deg);
        }
      }
      h2 {
        margin: 0;
        font-size: var(--fs-lg);
      }
      h2.center {
        text-align: center;
      }
    `,
  ],
})
export class ModalHeaderComponent {
  /** Иконка статуса (опц.). */
  public readonly classIcon = input<ModalHeaderClassIcon>();
  /** Центрировать заголовок. */
  public readonly textCenter = input(false);
}
