import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Страница 404 (неизвестный маршрут). Подключается как `**` в публичной зоне
 * (под `PublicLayoutComponent`) и в `/app` (под app-shell) — навигация даётся
 * окружающим layout'ом; здесь — сообщение и ссылка на главную.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {}
