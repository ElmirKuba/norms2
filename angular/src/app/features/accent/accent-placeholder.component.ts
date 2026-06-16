import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Заглушка сид-вкладки раздела «Акцент» (цели/привычки/…). Заголовок — из
 * `route.data.title`. Заменяется реальными экранами на подфазах 2.2–2.11.
 */
@Component({
  selector: 'app-accent-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ph">
      <h2>{{ title }}</h2>
      <p>Скоро.</p>
    </section>
  `,
  styles: [
    `
      .ph {
        padding: var(--space-5);
      }
      p {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AccentPlaceholderComponent {
  /** Заголовок вкладки из данных маршрута. */
  protected readonly title: string =
    (inject(ActivatedRoute).snapshot.data['title'] as string | undefined) ?? 'Раздел';
}
