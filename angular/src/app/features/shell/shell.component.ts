import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AuthApiService } from '../auth/services/auth-api.service';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';

/**
 * Каркас аутентифицированной зоны (`/app`). Пока минимальный: шапка (бренд +
 * тема + текущий аккаунт + выход) и плейсхолдер контента. Полная навигация и
 * разделы (профиль/инвайты/баны/сессии/настройки) — F3.1+.
 */
@Component({
  selector: 'app-shell',
  imports: [ThemeToggleComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _router = inject(Router);
  /** Текущий аккаунт (из стора). */
  protected readonly authStore = inject(AuthStore);

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
