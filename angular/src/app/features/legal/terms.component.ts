import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Условия использования (`/terms`) — правила пользования сервисом + дисклеймер
 * (нет гарантий, могут выключить, некоммерческий). Публичная, доступна до cookie-
 * согласия. Текст — финальная редакция (11 разделов; F6.1 вставка, F6.2 сверка с
 * кодом/ADR). §6 дополнен: ПДн не храним → раскрывать по сути нечего; при давлении
 * проект может быть перенесён или прекращён по обстоятельствам (ADR-0023, доп. F6.2).
 */
@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './legal-page.scss',
})
export class TermsComponent {}
