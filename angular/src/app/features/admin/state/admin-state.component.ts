import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminApiService } from '../services/admin-api.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { AdminReleaseState } from '../admin.types';

/**
 * Состояние выпуска (2.9.3·12) — «что развёрнуто и всё ли доехало».
 *
 * **Экран отвечает на один вопрос, который сегодня задаётся глазами по каналу: объявлен ли
 * последний релиз.** Ошибки доставки в канал глушатся осознанно (ADR-0064), и «посты перестали
 * уходить» видно только по логам. Здесь это одна строка.
 *
 * Ничего не переключает намеренно: рычаги живут на своих экранах, а этот показывает факт.
 */
@Component({
  selector: 'app-admin-state',
  imports: [CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-state.component.html',
  styleUrl: './admin-state.component.scss',
})
export class AdminStateComponent {
  private readonly _api = inject(AdminApiService);

  /** Состояние или null, пока не загрузилось. */
  public readonly state = signal<AdminReleaseState | null>(null);
  /** Идёт загрузка. */
  public readonly loading = signal(true);
  /** Текст ошибки или null. */
  public readonly error = signal<string | null>(null);

  public constructor() {
    this.reload();
  }

  /** Перечитывает состояние. */
  public reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this._api.releaseState().subscribe({
      next: (state) => {
        this.state.set(state);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /**
   * Дата человеческим видом.
   * @param iso Метка времени или null.
   * @returns Строка вида «8 августа, 12:00» или прочерк.
   */
  public when(iso: string | null): string {
    if (iso === null) {
      return '—';
    }
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
