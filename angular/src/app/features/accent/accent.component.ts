import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Раздел «Акцент» (фаза 2) — layout с вложенной навигацией (вкладки) + `router-outlet`
 * для под-экранов (дашборд/цели/привычки/микро-победы). Каркас 2.0.0·6: дашборд
 * рабочий (пауза), остальные вкладки — сид-заглушки (наполнятся 2.2–2.11).
 */
@Component({
  selector: 'app-accent',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="accent">
      <nav class="accent__tabs">
        <a routerLink="dashboard" routerLinkActive="active">Дашборд</a>
        <a routerLink="goals" routerLinkActive="active">Цели</a>
        <a routerLink="habits" routerLinkActive="active">Привычки</a>
        <a routerLink="micro-wins" routerLinkActive="active">Микро-победы</a>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: [
    `
      .accent__tabs {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
        padding: var(--space-3) var(--space-5) 0;
        border-bottom: 1px solid var(--color-border);
      }
      .accent__tabs a {
        padding: var(--space-2) var(--space-1);
        color: var(--color-text-muted);
        text-decoration: none;
        border-bottom: 2px solid transparent;
      }
      .accent__tabs a.active {
        color: var(--color-text);
        border-bottom-color: var(--color-accent);
      }
    `,
  ],
})
export class AccentComponent {}
