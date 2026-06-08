import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AccountApiService } from './services/account-api.service';
import { AvatarCropService } from './services/avatar-crop.service';
import { InvitesApiService } from '../invites/services/invites-api.service';
import { ModalService } from '../../shared/modals/modal.service';
import { avatarUrl } from '../../core/http/avatar-url.util';
import { errorMessage } from '../../core/http/error-message.util';
import { TextFieldComponent } from '../../shared/ui/text-field/text-field.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BannerComponent } from '../../shared/ui/banner/banner.component';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../shared/ui/spinner/spinner.component';
import type { AccountRead } from '../../core/interfaces/account-read.interface';
import type { InviterRead } from '../invites/invites.types';

/** RU-подписи источника регистрации. */
const SOURCE_LABELS: Readonly<Record<AccountRead['registrationSource'], string>> = {
  free: 'Свободная регистрация',
  invite: 'По приглашению',
  seed: 'Системный аккаунт',
};

/**
 * Мой профиль (`/app/profile`). Данные берёт из `AuthStore` (наполнен на старте
 * сессии); «кто меня пригласил» подтягивает из `GET /invites/my-inviter`. Правка
 * псевдонима — инлайн (`PATCH /accounts/me` → обновляет стор). Аватар (загрузка/
 * кроп) — F3.3, тут только отображение.
 */
@Component({
  selector: 'app-profile',
  imports: [
    DatePipe,
    RouterLink,
    TextFieldComponent,
    ButtonComponent,
    BannerComponent,
    CardComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly _accountApi = inject(AccountApiService);
  private readonly _invitesApi = inject(InvitesApiService);
  private readonly _avatarCrop = inject(AvatarCropService);
  private readonly _modal = inject(ModalService);
  /** Текущий аккаунт (из стора). */
  protected readonly authStore = inject(AuthStore);

  /** Идёт загрузка/удаление аватара. */
  protected readonly avatarBusy = signal(false);
  /** Ошибка операции с аватаром. */
  protected readonly avatarError = signal<string | null>(null);

  /** Пригласивший (или null) и флаг завершённой загрузки. */
  protected readonly inviter = signal<InviterRead | null>(null);
  protected readonly inviterLoaded = signal(false);

  /** Режим правки псевдонима. */
  protected readonly editing = signal(false);
  /** Идёт сохранение. */
  protected readonly saving = signal(false);
  /** Ошибка сохранения. */
  protected readonly formError = signal<string | null>(null);

  /** Контрол псевдонима (валидаторы-зеркало бэка: 3–32). */
  protected readonly aliasControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3), Validators.maxLength(32)],
  });

  /** URL аватара текущего аккаунта или null. */
  protected readonly avatarSrc = computed(() => avatarUrl(this.authStore.account()?.avatar ?? null));

  public constructor() {
    this._invitesApi.myInviter().subscribe({
      next: (inviter) => {
        this.inviter.set(inviter);
        this.inviterLoaded.set(true);
      },
      error: () => {
        this.inviterLoaded.set(true);
      },
    });
  }

  /** RU-подпись источника регистрации. */
  protected sourceLabel(source: AccountRead['registrationSource']): string {
    return SOURCE_LABELS[source];
  }

  /** Выбор файла → кроп в модалке → загрузка нарезанного квадрата. */
  protected async onAvatarFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // сброс — чтобы повторный выбор того же файла сработал
    if (file === null) {
      return;
    }
    this.avatarError.set(null);
    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Нужен файл изображения (JPEG, PNG или WEBP).');
      return;
    }
    const blob = await this._avatarCrop.open(file);
    if (blob === null) {
      return;
    }
    this._uploadAvatar(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
  }

  /** Удаляет аватар (с подтверждением). */
  protected async removeAvatar(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Удалить аватар?',
      text: 'Вернётся плейсхолдер с первой буквой псевдонима.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.avatarBusy.set(true);
    this.avatarError.set(null);
    this._accountApi.removeAvatar().subscribe({
      next: (account) => {
        this.authStore.setAccount(account);
        this.avatarBusy.set(false);
      },
      error: (error: unknown) => {
        this.avatarError.set(errorMessage(error));
        this.avatarBusy.set(false);
      },
    });
  }

  /** Отправляет нарезанный аватар на бэк → обновляет стор. */
  private _uploadAvatar(file: File): void {
    this.avatarBusy.set(true);
    this.avatarError.set(null);
    this._accountApi.uploadAvatar(file).subscribe({
      next: (account) => {
        this.authStore.setAccount(account);
        this.avatarBusy.set(false);
      },
      error: (error: unknown) => {
        this.avatarError.set(errorMessage(error));
        this.avatarBusy.set(false);
      },
    });
  }

  /** Первая буква псевдонима (для плейсхолдера аватара). */
  protected initial(alias: string): string {
    return alias.charAt(0).toUpperCase();
  }

  /** Включает правку псевдонима (подставляет текущее значение). */
  protected startEdit(): void {
    const me = this.authStore.account();
    if (me === null) {
      return;
    }
    this.aliasControl.setValue(me.alias);
    this.formError.set(null);
    this.editing.set(true);
  }

  /** Отменяет правку. */
  protected cancelEdit(): void {
    this.editing.set(false);
    this.formError.set(null);
  }

  /** Сохраняет псевдоним. */
  protected saveAlias(): void {
    if (this.aliasControl.invalid) {
      this.aliasControl.markAsTouched();
      this.formError.set('Псевдоним: от 3 до 32 символов.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this._accountApi.updateAlias(this.aliasControl.getRawValue()).subscribe({
      next: (account) => {
        this.authStore.setAccount(account);
        this.saving.set(false);
        this.editing.set(false);
      },
      error: (error: unknown) => {
        this.formError.set(errorMessage(error));
        this.saving.set(false);
      },
    });
  }
}
