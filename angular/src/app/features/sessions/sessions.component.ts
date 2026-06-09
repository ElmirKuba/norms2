import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SessionsApiService } from './services/sessions-api.service';
import { ModalService } from '../../shared/modals/modal.service';
import { errorMessage } from '../../core/http/error-message.util';
import { SpinnerComponent } from '../../shared/ui/spinner/spinner.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import type { SessionView } from './sessions.types';

/**
 * Раздел «Устройства» (сессии). Список активных сессий (`GET /sessions`) с
 * пометкой текущего устройства (`current` от сервера), завершение чужой сессии
 * (`DELETE /sessions/:id`) и «выйти на остальных» (`DELETE /sessions/others`).
 * Текущую сессию здесь не отзываем — для выхода с этого устройства есть «Выйти»
 * в шапке. Встраивается в Настройки → «Безопасность» (F3.7).
 */
@Component({
  selector: 'app-sessions',
  imports: [DatePipe, SpinnerComponent, EmptyStateComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss',
})
export class SessionsComponent {
  private readonly _api = inject(SessionsApiService);
  private readonly _modal = inject(ModalService);

  /** Активные сессии. */
  protected readonly sessions = signal<SessionView[]>([]);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);

  /** Есть ли другие устройства (кроме текущего). */
  protected readonly hasOthers = computed(() => this.sessions().some((session) => !session.current));

  public constructor() {
    this._reload();
  }

  /** Человекочитаемое имя устройства. */
  protected deviceName(session: SessionView): string {
    return session.userAgent ?? 'Неизвестное устройство';
  }

  /** Завершает одну сессию (с подтверждением). */
  protected async revoke(session: SessionView): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Завершить сессию?',
      text: 'Это устройство выйдет из аккаунта.',
      confirmText: 'Завершить',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this._api.revoke(session.id).subscribe({
      next: () => this.sessions.update((list) => list.filter((s) => s.id !== session.id)),
      error: (error: unknown) => this._modal.error('Не удалось завершить', errorMessage(error)),
    });
  }

  /** Завершает все сессии, кроме текущей (с подтверждением). */
  protected async revokeOthers(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Выйти на остальных устройствах?',
      text: 'Все сессии, кроме текущей, будут завершены.',
      confirmText: 'Выйти на остальных',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this._api.revokeOthers().subscribe({
      next: () => this.sessions.update((list) => list.filter((s) => s.current)),
      error: (error: unknown) => this._modal.error('Не удалось', errorMessage(error)),
    });
  }

  /** Загружает список сессий. */
  private _reload(): void {
    this.loading.set(true);
    this._api.listMine().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: () => {
        this.sessions.set([]);
        this.loading.set(false);
      },
    });
  }
}
