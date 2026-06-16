import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Раздел «Акцент» (фаза 2). Каркас (2.0.0·5) — заглушка; вложенная навигация
 * (дашборд/цели/привычки/…) и реальный дашборд появятся в 2.0.0·6 и далее.
 */
@Component({
  selector: 'app-accent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="accent-stub">
      <h1>Акцент</h1>
      <p>Раздел в разработке — скоро здесь будут цели, привычки и микро-победы.</p>
    </section>
  `,
  styles: [
    `
      .accent-stub {
        padding: var(--space-5);
      }
      h1 {
        margin: 0 0 var(--space-2);
      }
      p {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AccentComponent {}
