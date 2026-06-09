import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AuthApiService } from '../auth/services/auth-api.service';
import { InvitesApiService } from './services/invites-api.service';
import { ModalService } from '../../shared/modals/modal.service';
import { errorMessage } from '../../core/http/error-message.util';
import { TextFieldComponent } from '../../shared/ui/text-field/text-field.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BannerComponent } from '../../shared/ui/banner/banner.component';
import { CardComponent } from '../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SpinnerComponent } from '../../shared/ui/spinner/spinner.component';
import { BansComponent } from '../bans/bans.component';
import { InviteTreeComponent } from './invite-tree/invite-tree.component';
import type { InviteeRead, InviteCodeRead } from './invites.types';

/** Активная вкладка раздела. */
type InvitesTab = 'invites' | 'bans' | 'tree';

/**
 * Раздел «Приглашения» (`/app/invites`) — три вкладки (IA): **Мои инвайты** (квота,
 * создание/копирование/отзыв кодов, список приглашённых), **Баны** (`app-bans`) и
 * **Дерево** (`app-invite-tree` — поддерево приглашений, ленивое раскрытие). Квота
 * меняется на бэке при создании/отзыве — после операций обновляем `me()`.
 */
@Component({
  selector: 'app-invites',
  imports: [
    DatePipe,
    RouterLink,
    TextFieldComponent,
    ButtonComponent,
    BannerComponent,
    CardComponent,
    EmptyStateComponent,
    SpinnerComponent,
    BansComponent,
    InviteTreeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invites.component.html',
  styleUrl: './invites.component.scss',
})
export class InvitesComponent {
  /** Активная вкладка. */
  protected readonly tab = signal<InvitesTab>('invites');

  private readonly _api = inject(InvitesApiService);
  private readonly _authApi = inject(AuthApiService);
  private readonly _authStore = inject(AuthStore);
  private readonly _modal = inject(ModalService);

  /** Остаток квоты приглашений. */
  protected readonly invitesRemaining = computed(() => this._authStore.account()?.invitesRemaining ?? 0);

  /** Невыданные коды. */
  protected readonly codes = signal<InviteCodeRead[]>([]);
  /** Приглашённые (принявшие). */
  protected readonly invitees = signal<InviteeRead[]>([]);
  /** Идёт первичная загрузка списков. */
  protected readonly loading = signal(true);

  /** Идёт создание кода. */
  protected readonly creating = signal(false);
  /** Ошибка создания. */
  protected readonly createError = signal<string | null>(null);
  /** Код, недавно скопированный (для отметки «✓»). */
  protected readonly copiedId = signal<string | null>(null);

  /** Контрол причины (зеркало бэка: 1–500). */
  protected readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });

  public constructor() {
    this._reload();
  }

  /** Создаёт код приглашения. */
  protected createCode(): void {
    if (this.reasonControl.invalid) {
      this.reasonControl.markAsTouched();
      this.createError.set('Укажите причину (до 500 символов).');
      return;
    }
    if (this.invitesRemaining() <= 0) {
      this.createError.set('Квота приглашений исчерпана.');
      return;
    }
    this.creating.set(true);
    this.createError.set(null);
    this._api.create(this.reasonControl.getRawValue()).subscribe({
      next: (code) => {
        this.codes.update((list) => [code, ...list]);
        this.reasonControl.reset('');
        this.creating.set(false);
        this._refreshQuota();
      },
      error: (error: unknown) => {
        this.createError.set(errorMessage(error));
        this.creating.set(false);
      },
    });
  }

  /** Копирует код в буфер обмена. */
  protected async copyCode(code: InviteCodeRead): Promise<void> {
    try {
      await navigator.clipboard.writeText(code.code);
      this.copiedId.set(code.id);
      setTimeout(() => {
        if (this.copiedId() === code.id) {
          this.copiedId.set(null);
        }
      }, 1500);
    } catch {
      this._modal.error('Не удалось скопировать', 'Скопируйте код вручную.');
    }
  }

  /** Отзывает код (с подтверждением). */
  protected async revokeCode(code: InviteCodeRead): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Отозвать приглашение?',
      text: `Код «${code.code}» перестанет работать. Квота вернётся.`,
      confirmText: 'Отозвать',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this._api.revoke(code.id).subscribe({
      next: () => {
        this.codes.update((list) => list.filter((c) => c.id !== code.id));
        this._refreshQuota();
      },
      error: (error: unknown) => {
        this._modal.error('Не удалось отозвать', errorMessage(error));
      },
    });
  }

  /** Загружает оба списка. */
  private _reload(): void {
    this.loading.set(true);
    this._api.listCodes().subscribe({
      next: (codes) => this.codes.set(codes),
      error: () => this.codes.set([]),
    });
    this._api.listInvitees().subscribe({
      next: (invitees) => {
        this.invitees.set(invitees);
        this.loading.set(false);
      },
      error: () => {
        this.invitees.set([]);
        this.loading.set(false);
      },
    });
  }

  /** Подтягивает свежую квоту в стор после создания/отзыва. */
  private _refreshQuota(): void {
    this._authApi.me().subscribe({
      next: (account) => this._authStore.setAccount(account),
      error: () => {
        /* квота обновится при следующей загрузке профиля */
      },
    });
  }
}
