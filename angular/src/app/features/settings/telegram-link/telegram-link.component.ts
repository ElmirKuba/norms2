import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TelegramLinkApiService } from '../services/telegram-link-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { TelegramLinkStatus } from '../telegram-link.types';

/**
 * Привязка Telegram (вкладка «Telegram» в настройках, 2.9.1·14).
 *
 * **Зачем она человеку:** привязанный чат позволяет просить у владельца дополнительные
 * приглашения — начислять их «по словам» нельзя, аккаунт должен быть подтверждён.
 * **Уведомления она не включает:** это отдельное согласие, о котором бот спрашивает сам.
 *
 * Код одноразовый и живёт десять минут — экран показывает и то, и другое, чтобы «код не подошёл»
 * не выглядело поломкой.
 */
@Component({
  selector: 'app-telegram-link',
  imports: [ButtonComponent, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './telegram-link.component.html',
  styleUrl: './telegram-link.component.scss',
})
export class TelegramLinkComponent {
  private readonly _api = inject(TelegramLinkApiService);
  private readonly _modal = inject(ModalService);

  /** Состояние привязки. */
  protected readonly status = signal<TelegramLinkStatus | null>(null);
  /** Идёт первичная загрузка. */
  protected readonly loading = signal(true);
  /** Идёт выдача кода или отвязка. */
  protected readonly busy = signal(false);
  /** Выданный код (пока человек не ушёл со страницы). */
  protected readonly code = signal<string | null>(null);
  /** Сколько минут живёт код — для подсказки. */
  protected readonly codeMinutes = signal(10);
  /** Ошибка последнего действия. */
  protected readonly error = signal<string | null>(null);

  /** Ссылка на бота или null, если бот не настроен на этом стенде. */
  protected readonly botLink = computed(() => {
    const username = this.status()?.botUsername ?? '';
    return username === '' ? null : `https://t.me/${username}`;
  });

  /** Дата привязки человеческим текстом. */
  protected readonly linkedAtLabel = computed(() => {
    const raw = this.status()?.linkedAt ?? null;
    return raw === null ? '' : new Date(raw).toLocaleDateString('ru-RU');
  });

  public constructor() {
    this._load();
  }

  /** Просит новый код привязки. */
  protected issueCode(): void {
    this.busy.set(true);
    this.error.set(null);
    this._api.issueCode().subscribe({
      next: (view) => {
        this.code.set(view.code);
        this.codeMinutes.set(Math.max(1, Math.round(view.expiresInSeconds / 60)));
        this.busy.set(false);
      },
      error: (cause: unknown) => {
        this.error.set(errorMessage(cause));
        this.busy.set(false);
      },
    });
  }

  /** Отвязывает чат с подтверждением. */
  protected async unlink(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Отвязать Telegram?',
      text: 'Просить дополнительные приглашения из этого чата больше не получится. Привязать снова можно в любой момент.',
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this._api.unlink().subscribe({
      next: () => {
        this.code.set(null);
        this.busy.set(false);
        this._load();
      },
      error: (cause: unknown) => {
        this.error.set(errorMessage(cause));
        this.busy.set(false);
      },
    });
  }

  /** Загружает состояние привязки. */
  private _load(): void {
    this.loading.set(true);
    this._api.status().subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        this.error.set(errorMessage(cause));
        this.loading.set(false);
      },
    });
  }
}
