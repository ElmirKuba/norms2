import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Раздел «Акцент» (фаза 2) — layout с вложенной навигацией (вкладки) + `router-outlet`
 * для под-экранов (дашборд/цели/привычки/микро-победы). Вкладки на узком экране НЕ
 * переносятся, а скроллятся горизонтально (полоса скрыта во всех браузерах). Чтобы это
 * было очевидно (скрытая полоса = неявно), при заходе в раздел проигрываем «нудж» — меню
 * само чуть прокручивается вправо и возвращается, показывая, что его можно крутить вбок
 * (только если оно реально не влезает).
 *
 * TODO: Claude Code: 2026-06-19: вернуть одноразовость нуджа (persist в localStorage,
 * ключ 'accent-nav-hint-seen') — временно убрано, чтобы Elmir увидел поведение по Ctrl+R.
 */
@Component({
  selector: 'app-accent',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="accent">
      <nav #tabs class="accent__tabs">
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
export class AccentComponent implements AfterViewInit {
  /** Контейнер вкладок (для подсказки-нуджа горизонтального скролла). */
  private readonly _tabs = viewChild<ElementRef<HTMLElement>>('tabs');

  /** При заходе — нудж, если меню не влезает по ширине (пока без одноразовости — см. TODO). */
  public ngAfterViewInit(): void {
    const el = this._tabs()?.nativeElement;
    if (!el) {
      return;
    }
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow < 12) {
      return; // всё влезает (широкий экран) — крутить нечего, подсказка не нужна
    }
    const amount = Math.min(80, overflow);
    // Нудж: чуть вправо (контент уезжает справа-налево, открывая скрытые пункты) → обратно.
    window.setTimeout(() => el.scrollTo({ left: amount, behavior: 'smooth' }), 450);
    window.setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 1150);
  }
}
