import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminApiService } from '../services/admin-api.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { AdminSetting } from '../admin.types';

/**
 * Рантайм-настройки в админке (2.9.3·8 — чтение; переключение приходит в ·9).
 *
 * Показывает не только значение, но и **откуда оно взялось**: `env` — начальное из окружения,
 * `db` — переключено из админки. Без этого админ видит «выключено» и не понимает, он это сделал
 * или так было всегда.
 */
@Component({
  selector: 'app-admin-settings',
  imports: [DatePipe, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
})
export class AdminSettingsComponent {
  private readonly _api = inject(AdminApiService);

  /** Загруженные настройки. */
  public readonly settings = signal<AdminSetting[]>([]);
  /** Идёт ли загрузка. */
  public readonly loading = signal(true);
  /** Текст ошибки или null. */
  public readonly error = signal<string | null>(null);

  public constructor() {
    this.reload();
  }

  /** Перечитывает настройки с бэка. */
  public reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this._api.listSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /**
   * Человеческое имя настройки: ключи машинные, а на экран они попадают людям.
   * @param key Машинный ключ.
   * @returns Название для экрана.
   */
  public title(key: string): string {
    return key === 'telegram.bot.paused' ? 'Пауза Telegram-бота' : key;
  }

  /**
   * Что означает текущее значение — словами, а не «true».
   * @param setting Настройка.
   * @returns Состояние строкой.
   */
  public state(setting: AdminSetting): string {
    if (setting.key !== 'telegram.bot.paused') {
      return setting.value;
    }
    return setting.value === 'true' ? 'бот молчит' : 'бот отвечает';
  }
}
