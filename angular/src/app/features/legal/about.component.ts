import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * О проекте (`/about`) — open source, стек, прозрачность, лицензия. Публичная,
 * доступна до cookie-согласия. Пока сид-заглушка; наполнение — F5.3.
 */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './legal-page.scss',
})
export class AboutComponent {}
