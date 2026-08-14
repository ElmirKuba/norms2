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
  /** Что скопировано только что — для подписи на кнопке; гаснет через полторы секунды. */
  protected readonly copied = signal<'code' | 'command' | null>(null);

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

  /**
   * Копирует код или готовую команду `/link КОД` в буфер обмена.
   *
   * Команда отдельной кнопкой не для красоты: код переписывают глазами из браузера в Telegram, и
   * ровно поэтому в нём нет `0/O` и `1/I/l` — а копирование убирает этот риск целиком.
   *
   * @param what Что копируем: сам код или команду с ним.
   * @returns Промис завершения.
   */
  protected async copy(what: 'code' | 'command'): Promise<void> {
    const issued = this.code();
    if (issued === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(what === 'code' ? issued : `/link ${issued}`);
      this.copied.set(what);
      setTimeout(() => {
        if (this.copied() === what) {
          this.copied.set(null);
        }
      }, 1500);
    } catch {
      // Буфер недоступен (не-secure origin, отказ в разрешении) — код на экране виден, и
      // переписать его руками человек может: инструкция ниже никуда не делась.
      this._modal.error('Не удалось скопировать', 'Скопируйте код с экрана вручную.');
    }
  }

  /** Просит новый код привязки. */
  protected issueCode(): void {
    this.busy.set(true);
    this.error.set(null);
    this.copied.set(null);
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
      text:
        'Просить дополнительные приглашения из этого чата больше не получится, и бот перестанет ' +
        'писать о бане и решениях по заявкам. Привязать снова можно в любой момент — новым кодом.',
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this._api.unlink().subscribe({
      next: () => {
        this.code.set(null);
        this.copied.set(null);
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
