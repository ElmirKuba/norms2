import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AuthApiService } from '../auth/services/auth-api.service';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';

/** Пункт навигации ЛК. */
interface NavItem {
  /** Путь относительно /app. */
  path: string;
  /** Подпись. */
  label: string;
}

/**
 * Каркас аутентифицированной зоны (`/app`): шапка (бренд + навигация по разделам +
 * аккаунт/тема/выход) и `router-outlet` для разделов. Навигация адаптивная
 * (десктоп — в строку; узкий экран — переносится/скроллится). Разделы — дочерние
 * lazy-роуты (`shell.routes`).
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _router = inject(Router);
  /** Текущий аккаунт (из стора). */
  protected readonly authStore = inject(AuthStore);

  /** Разделы ЛК. */
  protected readonly nav: readonly NavItem[] = [
    { path: 'profile', label: 'Профиль' },
    { path: 'invites', label: 'Приглашения' },
    { path: 'sessions', label: 'Устройства' },
    { path: 'settings', label: 'Настройки' },
  ];

  /** Выход: отзыв сессии на сервере + очистка стора + на главную. */
  protected logout(): void {
    this._api.logout().subscribe({
      next: () => this._finishLogout(),
      error: () => this._finishLogout(),
    });
  }

  private _finishLogout(): void {
    this.authStore.clear();
    void this._router.navigate(['/']);
  }
}
