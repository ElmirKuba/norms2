import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeStore } from '../../../core/theme/theme-store.service';

/** Переключатель темы (тёмная↔светлая), управляет `ThemeStore`. */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" (click)="theme.toggle()" [attr.aria-label]="label()" [title]="label()">
      {{ theme.mode() === 'dark' ? '☀' : '🌙' }}
    </button>
  `,
  styles: [
    `
      .toggle {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border-radius: var(--radius-md);
        color: var(--color-text);
        font-size: 1.1rem;

        &:hover {
          background: var(--color-surface-2);
        }
      }
    `,
  ],
})
export class ThemeToggleComponent {
  /** Хранилище темы. */
  protected readonly theme = inject(ThemeStore);

  /** Подпись для a11y/тултипа. */
  protected readonly label = computed(() =>
    this.theme.mode() === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему',
  );
}
