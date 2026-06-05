import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';

/**
 * Публичный layout (главная + auth-экраны): центрированный контейнер с
 * переключателем темы в углу и `router-outlet` для экранов. Mobile-first.
 */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <app-theme-toggle />
    </header>
    <main class="content">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
      }
      .bar {
        display: flex;
        justify-content: flex-end;
        padding: var(--space-3) var(--space-4);
      }
      .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        width: 100%;
        max-width: 440px;
        margin: 0 auto;
      }
    `,
  ],
})
export class PublicLayoutComponent {}
