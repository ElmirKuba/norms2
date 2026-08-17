import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store.service';
import { AccountApiService } from '../profile/services/account-api.service';
import { deviceTimezone } from '../../core/config/device-timezone.util';

/**
 * Состояние подсказки «похоже, ты в другом часовом поясе» (2.10·A3).
 *
 * **Почему сервис, а не всё внутри компонента.** С переездом подсказки в колокол (реш. Elmir
 * 17.08.2026) её видимость нужна в двух местах сразу: сама строка живёт в панели уведомлений, а
 * колокол должен показать точку, иначе подсказка спрячется за закрытой панелью и человек о ней не
 * узнает. Держать одно условие в двух компонентах — верный способ развести их со временем.
 */
@Injectable({ providedIn: 'root' })
export class TimezoneHintService {
  private readonly _authStore = inject(AuthStore);
  private readonly _api = inject(AccountApiService);

  /** Зона, которую сообщает устройство. */
  public readonly deviceZone = signal(deviceTimezone() ?? '');
  /** Зона аккаунта: по ней считается граница суток. */
  public readonly accountZone = computed(() => this._authStore.account()?.timezone ?? 'UTC');
  /** Человек ответил в этой сессии — больше не показываем до перезагрузки. */
  private readonly _hidden = signal(false);

  /**
   * Показывать ли подсказку.
   *
   * Три случая из ADR-0070: устройство совпадает с выбранным поясом — молчим (и забываем прошлый
   * отказ); совпадает с отклонённым — молчим; отличается от обоих — предлагаем.
   */
  public readonly visible = computed(() => {
    const account = this._authStore.account();
    const device = this.deviceZone();
    if (account === null || device === '' || this._hidden()) {
      return false;
    }
    if (device === account.timezone) {
      return false;
    }
    return device !== account.dismissedTimezone;
  });

  /**
   * Забывает прежний отказ, когда человек вернулся в свой пояс.
   *
   * **Эффект, а не проверка внутри `visible()`**: `computed` обязан оставаться чистым, иначе
   * запрос уходил бы при каждом пересчёте — а пересчитывается он на каждой отрисовке колокола.
   * Сам сброс нужен, чтобы отказ не пережил поездку: сказал «не спрашивать» в Москве, вернулся
   * домой — и в следующей поездке подсказка снова работает.
   */
  private readonly _forgetDismissAtHome = effect(() => {
    const account = this._authStore.account();
    if (account === null || account.dismissedTimezone === null) {
      return;
    }
    if (this.deviceZone() === account.timezone) {
      this._api.dismissTimezone(null).subscribe({ error: () => undefined });
    }
  });

  /**
   * Запоминает отказ для текущей зоны устройства.
   * @returns Ничего.
   */
  public dismiss(): void {
    this._hidden.set(true);
    this._api.dismissTimezone(this.deviceZone()).subscribe({ error: () => undefined });
  }

  /**
   * Прячет подсказку до перезагрузки, ничего не запоминая (человек пошёл менять пояс).
   * @returns Ничего.
   */
  public hideForNow(): void {
    this._hidden.set(true);
  }
}
