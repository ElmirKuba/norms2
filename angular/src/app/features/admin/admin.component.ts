import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HscrollHintDirective } from '../../shared/ui/hscroll-hint.directive';

/**
 * Оболочка технической админки (2.9.3·8): подзаголовок раздела и вкладки.
 *
 * Раздел намеренно скучный. Он существует, чтобы **не лазить по ssh**, а не чтобы стать вторым
 * продуктом: ни статистики, ни графиков, ни дашбордов здесь не будет.
 */
@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HscrollHintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {}
