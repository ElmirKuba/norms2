import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AccountApiService } from '../profile/services/account-api.service';
import { deviceTimezone } from '../../core/config/device-timezone.util';

/**
 * Плашка «похоже, ты в другом поясе» (2.10·A3).
 *
 * **Строка, а не модалка** — и это не мелочь: предложение показывается при **каждом** входе из
 * чужого пояса (реш. Elmir 15.08.2026), а модалка при каждом входе превращается в наказание за
 * поездку — в командировке продукт открывают несколько раз в день, и человек, уже ответивший
 * «нет», получал бы то же окно снова.
 *
 * **Чекбокс «не спрашивать про этот пояс»** привязывает отказ к конкретной зоне. Отказался в
 * Москве — в Москве тихо; вернулся домой или уехал в третье место — отказ забывается сам, потому
 * что устройство сообщает уже другую зону. В логике нет ни одной даты: нечему протухать.
 *
 * Сама смена пояса здесь **не делается** — плашка ведёт в настройки, где стоят два подтверждения
 * (·A2). Смена сдвигает границу суток, и такое действие не должно совершаться в один клик по
 * баннеру.
 */
@Component({
  selector: 'app-timezone-hint',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="tzh" role="status">
        <span class="tzh__text">
          Похоже, ты в другом часовом поясе: <strong>{{ deviceZone() }}</strong>. Сейчас день
          считается по <strong>{{ accountZone() }}</strong>.
        </span>
        <label class="tzh__mute">
          <input type="checkbox" (change)="dismiss()" />
          не спрашивать про этот пояс
        </label>
        <app-button variant="ghost" (click)="goToSettings()">Сменить</app-button>
      </div>
    }
  `,
  styles: [
    `
      .tzh {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }

      .tzh__text {
        flex: 1;
        min-width: 220px;
      }

      .tzh__mute {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
      }
    `,
  ],
})
export class TimezoneHintComponent {
  private readonly _authStore = inject(AuthStore);
  private readonly _api = inject(AccountApiService);
  private readonly _router = inject(Router);

  /** Зона устройства. */
  protected readonly deviceZone = signal(deviceTimezone() ?? '');
  /** Зона аккаунта. */
  protected readonly accountZone = signal(this._authStore.account()?.timezone ?? 'UTC');
  /** Плашка скрыта до конца сессии (человек ответил). */
  private readonly _hidden = signal(false);

  /**
   * Показывать ли плашку.
   *
   * Три случая из решения: устройство совпадает с выбранным поясом — молчим (и забываем прошлый
   * отказ); совпадает с отклонённым — молчим; отличается от обоих — предлагаем.
   * @returns `true`, если плашку надо показать.
   */
  protected visible(): boolean {
    const account = this._authStore.account();
    const device = this.deviceZone();
    if (account === null || device === '' || this._hidden()) {
      return false;
    }
    if (device === account.timezone) {
      // Вернулся домой — прежний отказ больше ни к чему.
      if (account.dismissedTimezone !== null) {
        this._api.dismissTimezone(null).subscribe({ error: () => undefined });
      }
      return false;
    }
    return device !== account.dismissedTimezone;
  }

  /**
   * Запоминает отказ для текущей зоны устройства.
   * @returns Ничего.
   */
  protected dismiss(): void {
    this._hidden.set(true);
    this._api.dismissTimezone(this.deviceZone()).subscribe({ error: () => undefined });
  }

  /**
   * Ведёт в настройки — менять пояс нужно там, где стоят два подтверждения.
   * @returns Ничего.
   */
  protected goToSettings(): void {
    void this._router.navigate(['/app/settings']);
  }
}
