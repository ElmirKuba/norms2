import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeStore } from './core/theme/theme-store.service';

/**
 * Корневой компонент-оболочка приложения.
 * Содержит только точку рендера активного маршрута (router-outlet);
 * экраны ЛК подключаются как lazy-loaded feature-маршруты.
 * Инжектит `ThemeStore` — тема (класс на <html>) применяется при старте.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly _theme = inject(ThemeStore);
}
