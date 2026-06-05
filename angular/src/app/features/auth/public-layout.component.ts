import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';

/**
 * Публичный layout (главная + auth-экраны): центрированный контейнер с
 * переключателем темы в углу и `router-outlet` для экранов. Mobile-first.
 */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent {}
