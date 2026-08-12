import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminApiService } from '../services/admin-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
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
  imports: [DatePipe, CardComponent, SpinnerComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
})
export class AdminSettingsComponent {
  private readonly _api = inject(AdminApiService);
  private readonly _modals = inject(ModalService);

  /** Загруженные настройки. */
  public readonly settings = signal<AdminSetting[]>([]);
  /** Идёт ли загрузка. */
  public readonly loading = signal(true);
  /** Текст ошибки или null. */
  public readonly error = signal<string | null>(null);
  /** Ключ настройки, которая сейчас переключается (блокирует повторный клик). */
  public readonly saving = signal<string | null>(null);

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

  /**
   * Переключает булеву настройку — с подтверждением.
   *
   * **Подтверждение обязательно, и это не вежливость.** Пауза гасит и ответы людям, и приём
   * заявок, а написанное боту в это время **теряется** — цена принята осознанно (2.9.3·1), но
   * человек должен видеть её в момент нажатия, а не узнать потом. Поэтому в тексте прямо
   * сказано, что именно произойдёт.
   *
   * @param setting Настройка, которую переключаем.
   * @returns Промис завершения.
   */
  public async toggle(setting: AdminSetting): Promise<void> {
    const next = setting.value === 'true' ? 'false' : 'true';
    const pausing = next === 'true';
    const confirmed = await this._modals.confirm(
      pausing
        ? {
            title: 'Поставить бота на паузу?',
            text:
              'Бот перестанет отвечать людям, принимать заявки и постить в канал. ' +
              'Написанное ему во время паузы будет потеряно — эти сообщения не придут и после ' +
              'снятия паузы. Токен при этом остаётся на месте: вернуть бота — снять флаг.',
            confirmText: 'Поставить на паузу',
            danger: true,
          }
        : {
            title: 'Снять паузу?',
            text: 'Бот снова начнёт отвечать людям и принимать заявки.',
            confirmText: 'Снять паузу',
          },
    );
    if (!confirmed) {
      return;
    }

    this.saving.set(setting.key);
    this._api.updateSetting(setting.key, next).subscribe({
      next: (updated) => {
        // Точечная замена, а не перезагрузка списка: остальные настройки не менялись, и
        // перечитывать их значит моргать экраном без причины.
        this.settings.update((items) =>
          items.map((item) => (item.key === updated.key ? updated : item)),
        );
        this.saving.set(null);
      },
      error: (error: unknown) => {
        this.saving.set(null);
        this._modals.error('Не удалось переключить', errorMessage(error));
      },
    });
  }

  /**
   * Подпись кнопки переключения — глагол действия, а не состояние.
   * @param setting Настройка.
   * @returns Текст кнопки.
   */
  public actionLabel(setting: AdminSetting): string {
    if (setting.key !== 'telegram.bot.paused') {
      return setting.value === 'true' ? 'Выключить' : 'Включить';
    }
    return setting.value === 'true' ? 'Снять паузу' : 'Поставить на паузу';
  }
}
