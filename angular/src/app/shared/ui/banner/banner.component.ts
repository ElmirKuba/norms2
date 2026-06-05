import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Баннер-сообщение (info/success/warning/danger) — напоминания, подсказки. */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="banner {{ tone() }}"><ng-content /></div>`,
  styles: [
    `
      .banner {
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        font-size: var(--fs-sm);
        border-left: 3px solid var(--tone-color);
        background: color-mix(in srgb, var(--tone-color) 12%, var(--color-surface));
        color: var(--color-text);
      }
      .info {
        --tone-color: var(--color-accent);
      }
      .success {
        --tone-color: var(--color-success);
      }
      .warning {
        --tone-color: var(--color-warning);
      }
      .danger {
        --tone-color: var(--color-danger);
      }
    `,
  ],
})
export class BannerComponent {
  /** Тон баннера. */
  public readonly tone = input<'info' | 'success' | 'warning' | 'danger'>('info');
}
