import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AuthApiService } from '../auth/services/auth-api.service';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';

/** Пункт навигации ЛК. */
interface NavItem {
  /** Путь относительно /app. */
  path: string;
  /** Подпись. */
  label: string;
}

/**
 * Каркас аутентифицированной зоны (`/app`): шапка (бренд + верхнее меню фич +
 * тема + аккаунт-дропдаун) и `router-outlet`. Верхнее меню — только «контентные»
 * фичи (Приглашения; баны — вкладкой внутри); аккаунт-стафф (Профиль/Настройки/
 * Выйти) — в дропдауне по клику на имя. Разделы — дочерние lazy-роуты.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _router = inject(Router);
  /** Текущий аккаунт (из стора). */
  protected readonly authStore = inject(AuthStore);

  /** Верхнее меню — только фичи. */
  protected readonly nav: readonly NavItem[] = [{ path: 'invites', label: 'Приглашения' }];

  /** Открыт ли аккаунт-дропдаун. */
  protected readonly menuOpen = signal(false);

  /** Переключить дропдаун аккаунта. */
  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /** Закрыть дропдаун (по выбору пункта / клику вне). */
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Выход: отзыв сессии на сервере + очистка стора + на главную. */
  protected logout(): void {
    this.closeMenu();
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
