import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AuthApiService } from '../auth/services/auth-api.service';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { NotificationBellComponent } from '../notifications/notification-bell/notification-bell.component';
import { NotificationsStore } from '../notifications/services/notifications-store.service';
import { VersionService } from '../../core/version/version.service';

/** Пункт навигации ЛК. */
interface NavItem {
  /** Путь относительно /app. */
  path: string;
  /** Подпись. */
  label: string;
}

/**
 * Каркас аутентифицированной зоны (`/app`): шапка (бренд + верхнее меню фич +
 * колокол уведомлений + тема + аккаунт-дропдаун) и `router-outlet`. Верхнее меню —
 * только «контентные» фичи (Приглашения; баны — вкладкой внутри); на мобилке (< md)
 * сворачивается в бургер-дропдаун, на десктопе — инлайн-ряд. Аккаунт-стафф
 * (Профиль/Настройки/Выйти) + правовые ссылки (О проекте/Условия/Политика, в новой
 * вкладке — публичная зона) и версия — в дропдауне по клику на имя. Разделы —
 * дочерние lazy-роуты.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, NotificationBellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly _api = inject(AuthApiService);
  private readonly _router = inject(Router);
  private readonly _notifications = inject(NotificationsStore);
  /** Текущий аккаунт (из стора). */
  protected readonly authStore = inject(AuthStore);

  /** Запускает поллинг уведомлений на время жизни ЛК. */
  public ngOnInit(): void {
    this._notifications.startPolling();
  }

  /** Останавливает поллинг при выходе из ЛК. */
  public ngOnDestroy(): void {
    this._notifications.stopPolling();
  }

  /** Верхнее меню — только фичи. */
  protected readonly nav: readonly NavItem[] = [{ path: 'invites', label: 'Приглашения' }];

  /** Версия приложения (продукт + диагностика) для аккаунт-дропдауна. */
  protected readonly ver = inject(VersionService);

  /** Открыт ли аккаунт-дропдаун. */
  protected readonly menuOpen = signal(false);

  /** Открыто ли мобильное меню навигации (бургер). */
  protected readonly navOpen = signal(false);

  /** Переключить дропдаун аккаунта (закрывает бургер-меню). */
  protected toggleMenu(): void {
    this.navOpen.set(false);
    this.menuOpen.update((open) => !open);
  }

  /** Закрыть дропдаун (по выбору пункта / клику вне). */
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Переключить мобильное меню навигации (закрывает аккаунт-дропдаун). */
  protected toggleNav(): void {
    this.menuOpen.set(false);
    this.navOpen.update((open) => !open);
  }

  /** Закрыть мобильное меню навигации (по выбору пункта / клику вне). */
  protected closeNav(): void {
    this.navOpen.set(false);
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
