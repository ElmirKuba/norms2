import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountApiService } from '../profile/services/account-api.service';
import { AuthStore } from '../../core/auth/auth-store.service';
import { ModalService } from '../../shared/modals/modal.service';
import { errorMessage } from '../../core/http/error-message.util';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SessionsComponent } from '../sessions/sessions.component';
import { RecoverySettingsComponent } from './recovery-settings/recovery-settings.component';

/** Активная вкладка настроек. */
type SettingsTab = 'security' | 'account' | 'theme';

/**
 * Настройки (хаб из аккаунт-дропдауна). Вкладки: **Безопасность** (сессии F3.6;
 * секретные вопросы — F3.7.2), **Аккаунт** (деактивация/удаление с подтверждением
 * → сброс сессии и редирект), **Тема** (тумблер). Деактивация/удаление на бэке
 * отзывают сессии (ADR-0043), поэтому локально просто чистим стор и уходим.
 */
@Component({
  selector: 'app-settings',
  imports: [ThemeToggleComponent, ButtonComponent, CardComponent, SessionsComponent, RecoverySettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly _accountApi = inject(AccountApiService);
  private readonly _authStore = inject(AuthStore);
  private readonly _modal = inject(ModalService);
  private readonly _router = inject(Router);

  /** Активная вкладка. */
  protected readonly tab = signal<SettingsTab>('security');
  /** Идёт деактивация/удаление. */
  protected readonly busy = signal(false);

  /** Деактивирует аккаунт (обратимо) с подтверждением. */
  protected async deactivate(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Деактивировать аккаунт?',
      text: 'Аккаунт встанет на паузу и выйдет на всех устройствах. Войти снова можно тем же логином и паролем — при входе предложим восстановить.',
      confirmText: 'Деактивировать',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this._accountApi.deactivate().subscribe({
      next: () => this._finish(),
      error: (error: unknown) => {
        this._modal.error('Не удалось', errorMessage(error));
        this.busy.set(false);
      },
    });
  }

  /** Удаляет аккаунт (без восстановления, ADR-0017) с подтверждением. */
  protected async deleteAccount(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Удалить аккаунт?',
      text: 'Это действие необратимо: восстановления через интерфейс нет. Логин освободится не сразу. Точно удалить?',
      confirmText: 'Удалить навсегда',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this._accountApi.deleteMe().subscribe({
      next: () => this._finish(),
      error: (error: unknown) => {
        this._modal.error('Не удалось', errorMessage(error));
        this.busy.set(false);
      },
    });
  }

  /** Чистит сессию и уводит на главную (после деактивации/удаления). */
  private _finish(): void {
    this._authStore.clear();
    void this._router.navigate(['/']);
  }
}
