import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Условия использования (`/terms`) — правила пользования сервисом + дисклеймер
 * (нет гарантий, могут выключить, некоммерческий). Публичная, доступна до cookie-
 * согласия. Текст — финальная редакция от 9 июня 2026 (11 разделов, F6.1); сверка
 * формулировок с кодом/ADR (РФ-локализация §5, законные запросы §6 vs ADR-0023) —
 * в F6.2.
 */
@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './legal-page.scss',
})
export class TermsComponent {}
