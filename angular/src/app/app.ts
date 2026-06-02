import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Корневой компонент-оболочка приложения.
 * Содержит только точку рендера активного маршрута (router-outlet);
 * экраны ЛК подключаются как lazy-loaded feature-маршруты.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
