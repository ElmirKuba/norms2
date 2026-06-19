import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Ключ localStorage: подсказка-нудж горизонтального меню уже показана. */
const NAV_HINT_KEY = 'accent-nav-hint-seen';

/**
 * Раздел «Акцент» (фаза 2) — layout с вложенной навигацией (вкладки) + `router-outlet`
 * для под-экранов (дашборд/цели/привычки/микро-победы). Вкладки на узком экране НЕ
 * переносятся, а скроллятся горизонтально (полоса скрыта во всех браузерах). Чтобы это
 * было очевидно (скрытая полоса = неявно), при первом заходе в раздел проигрываем
 * одноразовый «нудж» — меню само чуть прокручивается вправо и возвращается, показывая,
 * что его можно крутить вбок (только если оно реально не влезает).
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

  /** При первом заходе — одноразовый нудж, если меню не влезает по ширине. */
  public ngAfterViewInit(): void {
    const el = this._tabs()?.nativeElement;
    if (!el || this._hintSeen()) {
      return;
    }
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow < 12) {
      return; // всё влезает (широкий экран) — крутить нечего, подсказка не нужна
    }
    this._markHintSeen();
    const amount = Math.min(80, overflow);
    // Нудж: чуть вправо (контент уезжает справа-налево, открывая скрытые пункты) → обратно.
    window.setTimeout(() => el.scrollTo({ left: amount, behavior: 'smooth' }), 450);
    window.setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 1150);
  }

  /** Показывали ли уже подсказку (persist; null-safe к окружению без localStorage). */
  private _hintSeen(): boolean {
    try {
      return localStorage.getItem(NAV_HINT_KEY) === '1';
    } catch {
      return true; // нет доступа к storage — не навязываемся
    }
  }

  /** Фиксирует, что подсказка показана (больше не повторяем). */
  private _markHintSeen(): void {
    try {
      localStorage.setItem(NAV_HINT_KEY, '1');
    } catch {
      // окружение без localStorage — игнорируем
    }
  }
}
