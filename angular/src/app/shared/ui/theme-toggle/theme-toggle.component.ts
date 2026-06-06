import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeStore } from '../../../core/theme/theme-store.service';

/** Переключатель темы (тёмная↔светлая), управляет `ThemeStore`. */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent {
  /** Хранилище темы. */
  protected readonly theme = inject(ThemeStore);

  /** Подпись для a11y/тултипа. */
  protected readonly label = computed(() =>
    this.theme.mode() === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему',
  );
}
