import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../services/auth-api.service';
import { AuthStore } from '../../../core/auth/auth-store.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorCode, errorMessage } from '../../../core/http/error-message.util';
import { TextFieldComponent } from '../../../shared/ui/text-field/text-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import type { BannedDetail, LoginCredentials } from '../auth.types';

/**
 * Экран входа. `POST /auth/login` → access в AuthStore + загрузка `/accounts/me`
 * → редирект в /app. Сигналы бэка: `ACCOUNT_DEACTIVATED` → модалка реактивации
 * (`POST /auth/reactivate` → повтор входа); `ACCOUNT_BANNED` → модалка «вы
 * забанены: кто/за что» из `details.bans` (ADR-0012/0038/0039).
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TextFieldComponent, ButtonComponent, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _authStore = inject(AuthStore);
  private readonly _modal = inject(ModalService);
  private readonly _router = inject(Router);

  /** Идёт вход. */
  protected readonly submitting = signal(false);
  /** Ошибка уровня формы. */
  protected readonly formError = signal<string | null>(null);

  /** Форма входа (без строгой валидации формата — неверные данные дают 401). */
  protected readonly form = new FormGroup({
    login: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** Отправляет вход. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this._login(this.form.getRawValue());
  }

  /** Выполняет вход и обрабатывает доменные сигналы. */
  private _login(credentials: LoginCredentials): void {
    this.submitting.set(true);
    this.formError.set(null);

    this._api.login(credentials).subscribe({
      next: (tokens) => {
        this._authStore.setAccessToken(tokens.accessToken);
        this._api.me().subscribe({
          next: (account) => {
            this._authStore.setAccount(account);
            void this._router.navigate(['/app']);
          },
          error: () => {
            this.formError.set('Не удалось загрузить профиль.');
            this.submitting.set(false);
          },
        });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this._handleLoginError(error, credentials);
      },
    });
  }

  /** Маршрутизирует ошибку входа: деактивация → реактивация, бан → детали. */
  private _handleLoginError(error: unknown, credentials: LoginCredentials): void {
    const code = errorCode(error);
    if (code === 'ACCOUNT_DEACTIVATED') {
      void this._offerReactivation(credentials);
      return;
    }
    if (code === 'ACCOUNT_BANNED') {
      this._showBanned(error);
      return;
    }
    this.formError.set(errorMessage(error));
  }

  /** Предлагает реактивацию деактивированного аккаунта и повторный вход. */
  private async _offerReactivation(credentials: LoginCredentials): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Аккаунт деактивирован',
      text: 'Восстановить аккаунт и войти?',
      confirmText: 'Восстановить',
      cancelText: 'Отмена',
    });
    if (!confirmed) {
      return;
    }
    this._api.reactivate(credentials).subscribe({
      next: () => {
        this._login(credentials);
      },
      error: (error: unknown) => {
        this.formError.set(errorMessage(error));
      },
    });
  }

  /** Показывает, кто и за что забанил (из details.bans). */
  private _showBanned(error: unknown): void {
    const bans = this._extractBans(error);
    const text =
      bans.length > 0
        ? bans.map((ban) => `• ${ban.reason}`).join('<br>')
        : 'Доступ к аккаунту закрыт.';
    this._modal.error('Вы забанены', text);
  }

  /** Достаёт список банов из конверта ошибки. */
  private _extractBans(error: unknown): BannedDetail[] {
    if (error instanceof HttpErrorResponse && error.error !== null && typeof error.error === 'object') {
      const details = (error.error as { error?: { details?: { bans?: BannedDetail[] } } }).error?.details;
      return details?.bans ?? [];
    }
    return [];
  }
}
