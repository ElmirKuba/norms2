import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AccountApiService } from '../services/account-api.service';
import { avatarUrl } from '../../../core/http/avatar-url.util';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import type { AccountPublicView } from '../profile.types';

/**
 * Публичный профиль участника (`/app/u/:login`). Читает `GET /accounts/:login`
 * (проекция login/alias/avatar — приватное наружу не уходит). Реагирует на смену
 * параметра `:login` (переход между профилями без пересоздания компонента).
 * `ACCOUNT_NOT_FOUND`/любая ошибка → состояние «не найдено».
 */
@Component({
  selector: 'app-user-profile',
  imports: [CardComponent, SpinnerComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent {
  private readonly _accountApi = inject(AccountApiService);
  private readonly _route = inject(ActivatedRoute);

  /** Загруженный профиль или null. */
  protected readonly profile = signal<AccountPublicView | null>(null);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Участник не найден. */
  protected readonly notFound = signal(false);

  /** URL аватара или null. */
  protected readonly avatarSrc = computed(() => avatarUrl(this.profile()?.avatar ?? null));

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

  /** Загружает публичный профиль по логину. */
  private _load(login: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.profile.set(null);
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
