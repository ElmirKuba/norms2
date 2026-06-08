import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BansApiService } from './services/bans-api.service';
import { ModalService } from '../../shared/modals/modal.service';
import { errorMessage } from '../../core/http/error-message.util';
import { SpinnerComponent } from '../../shared/ui/spinner/spinner.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import type { BanListItem } from './bans.types';

/**
 * Список «мои баны» (вкладка внутри Приглашений, IA). Показывает кого забанил
 * (alias-ссылка на профиль), причину, дату и статус; активный бан можно снять
 * (`DELETE /bans/:id` с подтверждением). Снятые остаются как история (active=false).
 */
@Component({
  selector: 'app-bans',
  imports: [DatePipe, RouterLink, SpinnerComponent, EmptyStateComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bans.component.html',
  styleUrl: './bans.component.scss',
})
export class BansComponent {
  private readonly _api = inject(BansApiService);
  private readonly _modal = inject(ModalService);

  /** Записи банов. */
  protected readonly bans = signal<BanListItem[]>([]);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);

  public constructor() {
    this._reload();
  }

  /** Снимает бан (с подтверждением). */
  protected async unban(ban: BanListItem): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Снять бан?',
      text: `Участник «${ban.targetAlias}» снова получит доступ.`,
      confirmText: 'Снять',
      cancelText: 'Отмена',
    });
    if (!confirmed) {
      return;
    }
    this._api.unban(ban.id).subscribe({
      next: () => {
        this.bans.update((list) =>
          list.map((b) => (b.id === ban.id ? { ...b, active: false } : b)),
        );
      },
      error: (error: unknown) => {
        this._modal.error('Не удалось снять бан', errorMessage(error));
      },
    });
  }

  /** Загружает список банов. */
  private _reload(): void {
    this.loading.set(true);
    this._api.listMine().subscribe({
      next: (bans) => {
        this.bans.set(bans);
        this.loading.set(false);
      },
      error: () => {
        this.bans.set([]);
        this.loading.set(false);
      },
    });
  }
}
