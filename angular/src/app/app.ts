import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeStore } from './core/theme/theme-store.service';
import { ConsentStore } from './core/consent/consent-store.service';
import { ConsentGateComponent } from './features/consent/consent-gate.component';

/**
 * Корневой компонент-оболочка. Блокирующий cookie-гейт (ADR-0024): пока согласие
 * не дано — рендерится только гейт, роуты не показываются. Инжектит `ThemeStore`
 * (тема применяется при старте).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentGateComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly _theme = inject(ThemeStore);
  /** Согласие на cookie — гейт. */
  protected readonly consent = inject(ConsentStore);
}
