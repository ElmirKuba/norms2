import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Условия использования (`/terms`) — правила пользования сервисом + дисклеймер
 * (нет гарантий, могут выключить, некоммерческий). Публичная, доступна до cookie-
 * согласия. Пока сид-заглушка; полный текст — F5.2 (на ревью Elmir'а).
 */
@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './legal-page.scss',
})
export class TermsComponent {}
