import { Injectable, Logger } from '@nestjs/common';
import { NotificationDomainService } from '../../../notifications/domain-services/notification.domain-service';
import type { AccentProgressNotifierPort } from './accent-progress-notifier.port';

/**
 * Реализация порта уведомлений через центр уведомлений фазы 1 (колокольчик). Инфра-адаптер:
 * конкретику знает только он, домен видит порт.
 *
 * **Ошибки доставки глушим.** Достижение уже выдано и лежит в БД; если нота не создалась,
 * человек увидит достижение на `/accent/stats` — терять из-за этого весь запрос статистики
 * было бы хуже, чем потерять одну строку в колокольчике.
 */
@Injectable()
export class NotificationProgressNotifierAdapter implements AccentProgressNotifierPort {
  /** Логгер области. */
  private readonly _logger = new Logger('AccentProgressNotifier');

  /**
   * @param _notifications Центр уведомлений (кросс-фаза вниз, через `NotificationCoreModule`).
   */
  public constructor(private readonly _notifications: NotificationDomainService) {}

  /**
   * @param accountId Кому.
   * @param title Заголовок.
   * @param body Текст.
   * @returns Промис завершения.
   */
  public async milestone(accountId: string, title: string, body: string): Promise<void> {
    try {
      await this._notifications.notifyPersonalMilestone(accountId, title, body);
    } catch (error) {
      this._logger.warn(`Не удалось доставить уведомление «${title}»: ${String(error)}`);
    }
  }
}
