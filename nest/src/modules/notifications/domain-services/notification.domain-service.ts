import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../adapters/notification-repository.port';
import type { NotificationRepositoryPort } from '../adapters/notification-repository.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { NotificationView } from '../interfaces/notification-view.interface';

/**
 * Domain-service области notifications: список/счётчик/отметки + создание
 * персональных уведомлений (зовётся кросс-доменно, напр. из регистрации по коду).
 * Зависит только от порта репозитория.
 */
@Injectable()
export class NotificationDomainService {
  /**
   * @param _notificationRepository Порт репозитория уведомлений.
   */
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly _notificationRepository: NotificationRepositoryPort,
  ) {}

  /**
   * Мои уведомления (broadcast + персональные), новые сверху, с флагом read.
   * @param accountId Смотрящий.
   * @returns Проекции.
   */
  public async list(accountId: string): Promise<NotificationView[]> {
    return this._notificationRepository.listForAccount(accountId);
  }

  /**
   * Число непрочитанных моих уведомлений.
   * @param accountId Смотрящий.
   * @returns Количество.
   */
  public async countUnread(accountId: string): Promise<number> {
    return this._notificationRepository.countUnread(accountId);
  }

  /**
   * Отмечает прочитанным — только если уведомление адресовано мне (broadcast или
   * персональное мне). Иначе no-op (без утечки). Идемпотентно.
   * @param accountId Смотрящий.
   * @param notificationId Уведомление.
   * @returns Промис завершения.
   */
  public async markRead(accountId: string, notificationId: string): Promise<void> {
    const notification = await this._notificationRepository.findById(notificationId);
    if (notification === null) {
      return;
    }
    if (notification.accountId !== null && notification.accountId !== accountId) {
      return;
    }
    await this._notificationRepository.insertRead(generateId(), accountId, notificationId);
  }

  /**
   * Отмечает все мои непрочитанные прочитанными.
   * @param accountId Смотрящий.
   * @returns Промис завершения.
   */
  public async markAllRead(accountId: string): Promise<void> {
    const ids = await this._notificationRepository.listUnreadIds(accountId);
    await this._notificationRepository.insertReads(
      ids.map((notificationId) => ({ id: generateId(), accountId, notificationId })),
    );
  }

  /**
   * Персональное уведомление пригласившему: по его коду присоединился участник.
   * Best-effort (зовётся после успешной регистрации; не в транзакции).
   * @param inviterId Кому (пригласивший).
   * @param joinedLogin Логин присоединившегося.
   * @returns Промис завершения.
   */
  public async notifyInviteAccepted(inviterId: string, joinedLogin: string): Promise<void> {
    await this._notificationRepository.create(generateId(), {
      kind: 'personal',
      accountId: inviterId,
      title: 'Новый участник',
      body: `По вашему коду присоединился @${joinedLogin}`,
      contentFile: null,
      key: null,
    });
  }
}
