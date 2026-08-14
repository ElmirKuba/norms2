import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import {
  escapeHtml,
  TelegramDomainService,
} from '../../telegram/domain-services/telegram.domain-service';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';
import { ValidationError } from '../../../shared/errors/validation.error';
import type { AdminActor } from '../interfaces/admin-actor.interface';

/**
 * Бан из админки (`POST /admin/bans`, 2.9.3·26, реш. Elmir 14.08.2026).
 *
 * **Отдельная ручка, а не расширение обычной.** У обычного бана право идёт по ветке приглашений
 * ([ADR-0003](../../../../docs/decisions/0003-ban-semantics.md)): забанить можно только своё
 * поддерево. У админа границ ветки нет — он модератор, а не участник отношений. Смешать оба
 * правила в одном эндпоинте значило бы спрятать разницу в условии внутри метода, а её видно по
 * адресу. Обычному человеку эта ручка недоступна физически: весь `/admin/*` без роли отдаёт 404.
 *
 * **Причина обязательна и здесь** (реш. Elmir): «иначе для пользователей не прозрачно, что
 * произошло». Человек прочитает её при попытке входа и получит от бота, если привязал Telegram.
 *
 * **Идемпотентно:** повтор по той же паре не создаёт вторую запись, а обновляет причину — на
 * этом стоит частичный unique `(banner, target) where active`.
 */
@Injectable()
export class BanFromAdminUseCase {
  /**
   * @param _bans Domain-service банов (кросс-домен вниз).
   * @param _telegram Бот — сказать человеку, что произошло.
   * @param _audit Журнал действий.
   */
  public constructor(
    private readonly _bans: BanDomainService,
    private readonly _telegram: TelegramDomainService,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Банит человека от имени админа.
   * @param targetId Кого.
   * @param reason Причина (обязательна).
   * @param actor Кто банит.
   * @returns Промис завершения.
   * @throws {ValidationError} Если цель — сам админ.
   */
  public async execute(targetId: string, reason: string, actor: AdminActor): Promise<void> {
    if (targetId === actor.accountId) {
      throw new ValidationError('Себя забанить нельзя.');
    }

    await this._bans.ban(actor.accountId, targetId, reason.trim());
    await this._audit.record({
      actorAccountId: actor.accountId,
      actorLogin: actor.login,
      action: AUDIT_ACTIONS.BAN_ISSUED,
      targetType: 'account',
      targetId,
      details: { reason: reason.trim(), byAdmin: true },
    });

    // Сбой доставки не отменяет бан: объяснение человек в любом случае увидит на входе.
    await this._telegram
      .notifyAccount(
        targetId,
        [
          '<b>Доступ закрыт</b>',
          '',
          `Причина: ${escapeHtml(reason.trim())}`,
          '',
          'Считаешь, что это ошибка? Нажми /start и выбери «Меня забанили».',
        ].join('\n'),
      )
      .catch(() => false);
  }
}
