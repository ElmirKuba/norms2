import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HscrollHintDirective } from '../../shared/ui/hscroll-hint.directive';

/**
 * Раздел «Акцент» (фаза 2) — layout с вложенной навигацией (вкладки) + `router-outlet`
 * для под-экранов (дашборд/цели/привычки/микро-победы). Вкладки на узком экране НЕ
 * переносятся, а скроллятся горизонтально (полоса скрыта во всех браузерах). Чтобы скрытый
 * скролл был очевиден — нудж-подсказка через `appHscrollHint` (директива, переиспользуется).
 */
@Component({
  selector: 'app-accent',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, HscrollHintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="accent">
      <nav class="accent__tabs" appHscrollHint>
        <a routerLink="dashboard" routerLinkActive="active">Дашборд</a>
        <a routerLink="goals" routerLinkActive="active">Цели</a>
        <a routerLink="habits" routerLinkActive="active">Привычки</a>
        <a routerLink="anti-habits" routerLinkActive="active">Держусь</a>
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
        flex-wrap: nowrap;
        overflow-x: auto;
        scroll-behavior: smooth;
        padding: var(--space-3) var(--space-5) 0;
        border-bottom: 1px solid var(--color-border);
        // Полосу прокрутки скрываем во всех браузерах (крутим пальцем/нуджем).
        scrollbar-width: none; // Firefox
        -ms-overflow-style: none; // старый Edge/IE
      }
      .accent__tabs::-webkit-scrollbar {
        display: none; // Chrome/Safari/новый Edge
      }
      .accent__tabs a {
        flex-shrink: 0;
        white-space: nowrap;
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
