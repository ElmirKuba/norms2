import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationDomainService } from '../../notifications/domain-services/notification.domain-service';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';

/**
 * Удаление публикации релиза из админки (2.9.3·7).
 *
 * Заменяет три ручных `delete` в psql, которыми это делалось 09.08.2026: каскад по
 * `notifications.release_id` уносит доставку, а оттуда — отметки прочтения.
 *
 * **Журнал пишется здесь, а не в доменном сервисе**, в отличие от настроек: удаление публикации
 * бывает только по команде человека, а у настроек есть и системные записи. Актёр тут всегда
 * известен, и запись без него была бы неполной.
 */
@Injectable()
export class DeleteReleaseUseCase {
  /**
   * @param _notifications Доменный сервис уведомлений и публикаций.
   * @param _audit Журнал действий.
   */
  public constructor(
    private readonly _notifications: NotificationDomainService,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Удаляет публикацию по ключу.
   * @param key Публичный ключ (`release-2.9.2`).
   * @param actorAccountId Аккаунт админа.
   * @param actorLogin Логин админа — снимком в журнал.
   * @returns Промис завершения.
   * @throws {NotFoundException} Если публикации с таким ключом нет.
   */
  public async execute(key: string, actorAccountId: string, actorLogin: string): Promise<void> {
    const removed = await this._notifications.deleteRelease(key);
    if (removed === null) {
      throw new NotFoundException();
    }
    await this._audit.record({
      action: AUDIT_ACTIONS.RELEASE_DELETED,
      actorAccountId,
      actorLogin,
      targetType: 'release',
      targetId: removed.key,
      targetLabel: removed.title,
    });
  }
}
