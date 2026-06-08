import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AccountApiService } from '../services/account-api.service';
import { BansApiService } from '../../bans/services/bans-api.service';
import { AuthStore } from '../../../core/auth/auth-store.service';
import { avatarUrl } from '../../../core/http/avatar-url.util';
import { errorMessage } from '../../../core/http/error-message.util';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { TextFieldComponent } from '../../../shared/ui/text-field/text-field.component';
import type { AccountPublicView } from '../profile.types';

/**
 * Публичный профиль участника (`/app/u/:login`). Читает `GET /accounts/:login`
 * (id/login/alias/avatar; id — как `targetId` для бана). Реагирует на смену
 * параметра. Действие **«Забанить»** (`POST /bans`, инлайн-форма с причиной +
 * предупреждением про ПДн): доступно не на своём профиле; `BAN_FORBIDDEN` (себя/
 * вне поддерева) → понятное сообщение. `ACCOUNT_NOT_FOUND` → «не найдено».
 */
@Component({
  selector: 'app-user-profile',
  imports: [
    CardComponent,
    SpinnerComponent,
    EmptyStateComponent,
    ButtonComponent,
    BannerComponent,
    TextFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent {
  private readonly _accountApi = inject(AccountApiService);
  private readonly _bansApi = inject(BansApiService);
  private readonly _authStore = inject(AuthStore);
  private readonly _route = inject(ActivatedRoute);

  /** Загруженный профиль или null. */
  protected readonly profile = signal<AccountPublicView | null>(null);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Участник не найден. */
  protected readonly notFound = signal(false);

  /** Открыта ли форма бана. */
  protected readonly banFormOpen = signal(false);
  /** Идёт отправка бана. */
  protected readonly banSubmitting = signal(false);
  /** Ошибка бана. */
  protected readonly banError = signal<string | null>(null);
  /** Бан успешно поставлен (в этой сессии просмотра). */
  protected readonly banned = signal(false);

  /** Контрол причины бана (зеркало бэка: 1–500). */
  protected readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });

  /** URL аватара или null. */
  protected readonly avatarSrc = computed(() => avatarUrl(this.profile()?.avatar ?? null));

  /** Это мой собственный профиль (банить нельзя — кнопку прячем). */
  protected readonly isOwnProfile = computed(() => {
    const me = this._authStore.account();
    const them = this.profile();
    return me !== null && them !== null && me.login.toLowerCase() === them.login.toLowerCase();
  });

  public constructor() {
    this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const login = params.get('login');
      if (login === null || login === '') {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this._load(login);
    });
  }

  /** Первая буква псевдонима (плейсхолдер аватара). */
  protected initial(alias: string): string {
    return alias.charAt(0).toUpperCase();
  }

  /** Показывает форму бана. */
  protected openBanForm(): void {
    this.reasonControl.reset('');
    this.banError.set(null);
    this.banFormOpen.set(true);
  }

  /** Скрывает форму бана. */
  protected cancelBan(): void {
    this.banFormOpen.set(false);
    this.banError.set(null);
  }

  /** Отправляет бан. */
  protected submitBan(): void {
    const target = this.profile();
    if (target === null) {
      return;
    }
    if (this.reasonControl.invalid) {
      this.reasonControl.markAsTouched();
      this.banError.set('Укажите причину (до 500 символов).');
      return;
    }
    this.banSubmitting.set(true);
    this.banError.set(null);
    this._bansApi.create(target.id, this.reasonControl.getRawValue()).subscribe({
      next: () => {
        this.banSubmitting.set(false);
        this.banFormOpen.set(false);
        this.banned.set(true);
      },
      error: (error: unknown) => {
        this.banSubmitting.set(false);
        this.banError.set(errorMessage(error));
      },
    });
  }

  /** Загружает публичный профиль по логину. */
  private _load(login: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.profile.set(null);
    this.banFormOpen.set(false);
    this.banned.set(false);
    this._accountApi.getByLogin(login).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }
}
