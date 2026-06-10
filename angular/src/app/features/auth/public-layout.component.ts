import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { environment } from '../../../environments/environment';

/**
 * Публичный layout (главная + auth + правовые/about): шапка (бренд → главная +
 * тема), центрированный `router-outlet` и футер со ссылками (О проекте / Условия /
 * Политика) и версией. Бренд и футер дают возврат на главную и доступ к докам с
 * любого публичного экрана. Mobile-first.
 */
@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent {
  /** Версия приложения (для футера). */
  protected readonly version = environment.appVersion;
}
