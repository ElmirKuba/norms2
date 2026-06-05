import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Лёгкая кнопка на глобальных `.btn`-стилях (accent/ghost/danger, loading, block). */
@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="btn"
      [class.btn-ghost]="variant() === 'ghost'"
      [class.btn-danger]="variant() === 'danger'"
      [class.btn-block]="block()"
      [type]="type()"
      [disabled]="disabled() || loading()"
    >
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid currentColor;
        border-top-color: transparent;
        animation: btn-spin 0.7s linear infinite;
      }
      @keyframes btn-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ButtonComponent {
  /** Визуальный вариант. */
  public readonly variant = input<'accent' | 'ghost' | 'danger'>('accent');
  /** Тип нативной кнопки. */
  public readonly type = input<'button' | 'submit'>('button');
  /** Заблокирована. */
  public readonly disabled = input(false);
  /** Состояние загрузки (спиннер + блок). */
  public readonly loading = input(false);
  /** На всю ширину. */
  public readonly block = input(false);
}
