import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountApiService } from '../profile/services/account-api.service';
import { AuthStore } from '../../core/auth/auth-store.service';
import { ModalService } from '../../shared/modals/modal.service';
import { errorMessage } from '../../core/http/error-message.util';
import { deviceTimezone } from '../../core/config/device-timezone.util';
import { FocusTargetDirective } from '../../shared/ui/focus-target.directive';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle/theme-toggle.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SessionsComponent } from '../sessions/sessions.component';
import { RecoverySettingsComponent } from './recovery-settings/recovery-settings.component';
import { TelegramLinkComponent } from './telegram-link/telegram-link.component';

/** Активная вкладка настроек. */
type SettingsTab = 'security' | 'telegram' | 'account' | 'theme';

/**
 * Настройки (хаб из аккаунт-дропдауна). Вкладки: **Безопасность** (сессии F3.6;
 * секретные вопросы — F3.7.2), **Аккаунт** (деактивация/удаление с подтверждением
 * → сброс сессии и редирект), **Telegram** (привязка чата одноразовым кодом — нужна, чтобы просить
 * дополнительные приглашения), **Тема** (тумблер). Деактивация/удаление на бэке
 * отзывают сессии (ADR-0043), поэтому локально просто чистим стор и уходим.
 */
@Component({
  selector: 'app-settings',
  imports: [ThemeToggleComponent, ButtonComponent, CardComponent, SessionsComponent, RecoverySettingsComponent, TelegramLinkComponent, FocusTargetDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly _accountApi = inject(AccountApiService);
  private readonly _authStore = inject(AuthStore);
  private readonly _modal = inject(ModalService);
  private readonly _router = inject(Router);

  /**
   * Активная вкладка.
   *
   * Читается из адреса (`?tab=account`), чтобы ссылка могла привести человека **сразу туда, где
   * лежит нужная настройка**: плашка часового пояса ведёт в настройки, и высаживать его на
   * «Безопасность» с предложением «ищи сам» — значит терять то внимание, которое он уже направил
   * (замечание Elmir 16.08.2026).
   */
  protected readonly tab = signal<SettingsTab>(
    (inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as SettingsTab | null) ?? 'security',
  );
  /** Идёт деактивация/удаление. */
  protected readonly busy = signal(false);
  /** Текущий часовой пояс аккаунта. */
  protected readonly timezone = signal(this._authStore.account()?.timezone ?? 'UTC');
  /** Что сообщает устройство — показываем, если расходится с сохранённым. */
  protected readonly deviceZone = signal(deviceTimezone() ?? '');

  /**
   * Меняет часовой пояс — через **два подтверждения подряд** (реш. Elmir 15.08.2026).
   *
   * Первое говорит «это серьёзно», второе показывает **что именно потеряется** в цифрах: одинаковый
   * текст дважды прокликивается на автомате, а числа, касающиеся лично тебя, прочитать придётся.
   * У второго окна кнопки **меняются местами** — по мышечной памяти рука идёт в прежний угол и
   * попадает в отмену, то есть промах безопасен.
   * @returns Промис завершения.
   */
  protected async changeTimezone(): Promise<void> {
    const zone = this.deviceZone();
    if (zone === '' || zone === this.timezone()) {
      this._modal.success('Часовой пояс', 'Устройство сообщает тот же пояс — менять нечего.');
      return;
    }

    const first = await this._modal.confirm({
      title: 'Сменить часовой пояс?',
      text:
        `Сейчас: ${this.timezone()}. Смена сдвинет границу суток — убедись, что всё за текущий ` +
        'день учтено: вернуться и закрыть его будет нельзя.',
      confirmText: 'Дальше',
      danger: true,
    });
    if (!first) {
      return;
    }

    const now = new Date();
    const было = new Intl.DateTimeFormat('ru-RU', {
      timeZone: this.timezone(),
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
    const станет = new Intl.DateTimeFormat('ru-RU', {
      timeZone: zone,
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);

    const second = await this._modal.confirm({
      title: 'Точно меняем?',
      text: `Сейчас у тебя ${было}. После смены станет ${станет}. Точно меняем?`,
      confirmText: 'Сменить',
      cancelText: 'Оставить',
      danger: true,
      buttonsOrderReversed: false,
    });
    if (!second) {
      return;
    }

    this.busy.set(true);
    this._accountApi.updateTimezone(zone).subscribe({
      next: (result) => {
        this.timezone.set(result.timezone);
        this.busy.set(false);
        this._modal.success('Часовой пояс изменён', `Теперь день считается по ${result.timezone}.`);
      },
      error: (error: unknown) => {
        this._modal.error('Не удалось сменить', errorMessage(error));
        this.busy.set(false);
      },
    });
  }

  /** Деактивирует аккаунт (обратимо) с подтверждением. */
  protected async deactivate(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Деактивировать аккаунт?',
      text: 'Аккаунт встанет на паузу и выйдет на всех устройствах. Войти снова можно тем же логином и паролем — при входе предложим восстановить.',
      confirmText: 'Деактивировать',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this._accountApi.deactivate().subscribe({
      next: () => this._finish(),
      error: (error: unknown) => {
        this._modal.error('Не удалось', errorMessage(error));
        this.busy.set(false);
      },
    });
  }

  /** Удаляет аккаунт (без восстановления, ADR-0017) с подтверждением. */
  protected async deleteAccount(): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Удалить аккаунт?',
      text:
        'Это действие необратимо: восстановления через интерфейс нет. Уйдёт всё — привычки, цели, ' +
        '«Держусь», препятствия, микро-победы, сессии и секретные вопросы. ' +
        'Логин останется занятым навсегда: освободить его нельзя. Точно удалить?',
      confirmText: 'Удалить навсегда',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this._accountApi.deleteMe().subscribe({
      next: () => this._finish(),
      error: (error: unknown) => {
        this._modal.error('Не удалось', errorMessage(error));
        this.busy.set(false);
      },
    });
  }

  /** Чистит сессию и уводит на главную (после деактивации/удаления). */
  private _finish(): void {
    this._authStore.clear();
    void this._router.navigate(['/']);
  }
}
