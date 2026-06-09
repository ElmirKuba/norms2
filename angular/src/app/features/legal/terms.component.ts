import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Условия использования (`/terms`) — правила пользования сервисом + дисклеймер
 * (нет гарантий, могут выключить, некоммерческий). Публичная, доступна до cookie-
 * согласия. Текст — черновик под ревью (F5.2).
 */
@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './legal-page.scss',
})
export class TermsComponent {}
