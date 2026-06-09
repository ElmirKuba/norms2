import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ThemeStore } from './core/theme/theme-store.service';
import { ConsentStore } from './core/consent/consent-store.service';
import { ConsentGateComponent } from './features/consent/consent-gate.component';

/** Пути, доступные ДО cookie-согласия (правовое/about читают до «Я согласен»). */
const PRE_CONSENT_PATHS = ['/privacy', '/terms', '/about'];

/**
 * Корневой компонент-оболочка. Блокирующий cookie-гейт (ADR-0024): пока согласие
 * не дано — рендерится гейт, роуты скрыты. Исключение — `/privacy` (политику можно
 * прочитать до согласия). Инжектит `ThemeStore` (тема применяется при старте).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentGateComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly _theme = inject(ThemeStore);
  private readonly _router = inject(Router);
  /** Согласие на cookie — гейт. */
  protected readonly consent = inject(ConsentStore);

  /** Текущий URL (реактивно, по навигации). */
  private readonly _url = toSignal(
    this._router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this._router.url },
  );

  /** Показывать роуты: согласие дано ИЛИ открыт до-согласный путь (/privacy). */
  protected readonly showRoutes = computed(
    () => this.consent.granted() || PRE_CONSENT_PATHS.some((path) => this._url().startsWith(path)),
  );
}
