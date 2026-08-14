import { Inject, Injectable, Logger } from '@nestjs/common';
import { AUDIT_REPOSITORY } from '../adapters/audit-repository.port';
import type { AuditRepositoryPort } from '../adapters/audit-repository.port';
import type { AuditEntryBase } from '../interfaces/audit-entry-base.interface';
import type { AuditEntryRow } from '../interfaces/audit-entry-row.interface';

/** Коды действий журнала (2.9.3·6). Машинные, стабильные: по ним потом фильтруют. */
export const AUDIT_ACTIONS = {
  /** Роль выдана аккаунту. */
  ROLE_GRANTED: 'role.granted',
  /** Базовая роль досыпана существующим аккаунтам (одной записью на прогон). */
  ROLE_BACKFILLED: 'role.backfilled',
  /** Значение рантайм-настройки изменено. */
  SETTING_CHANGED: 'setting.changed',
  /** Роль снята с аккаунта. */
  ROLE_REVOKED: 'role.revoked',
  /** Публикация релиза удалена (каскадом ушли доставка и отметки прочтения). */
  RELEASE_DELETED: 'release.deleted',
  /** Публикация релиза создана (в колокольчиках появилась, в канал ещё не ушла). */
  RELEASE_CREATED: 'release.created',
  /** Релиз объявлен во внешний канал по команде человека. */
  RELEASE_BROADCASTED: 'release.broadcasted',
  /** Заявка на вступление одобрена — выдан код приглашения. */
  TELEGRAM_REQUEST_APPROVED: 'telegram.request.approved',
  /** Просьба о приглашениях удовлетворена — начислена квота. */
  TELEGRAM_REQUEST_GRANTED: 'telegram.request.granted',
  /** Бан выдан из админки — вне ветки приглашений (2.9.3·26). */
  BAN_ISSUED: 'ban.issued',
  /** Бан снят: банившим, его предком по ветке или админом (2.9.3·21). */
  BAN_LIFTED: 'ban.lifted',
  /** По заявке отказано. */
  TELEGRAM_REQUEST_REJECTED: 'telegram.request.rejected',
} as const;

/** Что пишется в журнал: содержательные поля, часть из которых имеет разумное умолчание. */
export type AuditRecord = Pick<AuditEntryBase, 'action'> & Partial<Omit<AuditEntryBase, 'action'>>;

/**
 * Журнал действий администратора (2.9.3·6).
 *
 * **Запись — best-effort и НИКОГДА не роняет вызвавшую операцию.** Выбор осознанный и не
 * бесплатный: сбой журнала означает пропавшую улику. Но альтернатива хуже — админка, которая
 * отказывается снять роль, потому что не смогла об этом записать, превращает журнал из
 * страховки в единую точку отказа. Журнал здесь — доверие между тремя людьми, а не юридическое
 * доказательство; поэтому сбой уходит в лог уровня `error`, а операция продолжается.
 *
 * **Системные действия пишутся с `actorAccountId = null`.** Сид выдаёт роли при старте, и это
 * тоже изменение прав: запись «система выдала admin такому-то» нужна ровно так же, как запись о
 * человеке. Пустой актёр здесь — значение, а не отсутствие данных.
 */
@Injectable()
export class AuditDomainService {
  private readonly _logger = new Logger(AuditDomainService.name);

  /**
   * @param _repository Порт репозитория журнала.
   */
  public constructor(@Inject(AUDIT_REPOSITORY) private readonly _repository: AuditRepositoryPort) {}

  /**
   * Дописывает запись в журнал. Не бросает: сбой журнала не должен ломать бизнес-операцию.
   * @param record Что произошло.
   * @returns Промис завершения.
   */
  public async record(record: AuditRecord): Promise<void> {
    try {
      await this._repository.append({
        actorAccountId: record.actorAccountId ?? null,
        actorLogin: record.actorLogin ?? null,
        action: record.action,
        targetType: record.targetType ?? null,
        targetId: record.targetId ?? null,
        targetLabel: record.targetLabel ?? null,
        details: record.details ?? null,
      });
    } catch (error) {
      this._logger.error(`Не удалось записать в журнал '${record.action}': ${String(error)}`);
    }
  }

  /**
   * Читает последние записи журнала, новые сверху.
   *
   * **Незнакомый код действия в фильтре — пустая лента, а не ошибка.** Коды в записях остаются
   * навсегда, а справочник `AUDIT_ACTIONS` живёт вместе с кодом: действие могут переименовать
   * или убрать. Отбивать такой фильтр значило бы запрещать читать собственный журнал.
   *
   * @param limit Сколько записей вернуть (по умолчанию 100).
   * @param action Код действия для фильтра или `null` — тогда все подряд.
   * @returns Строки журнала.
   */
  public async recent(limit: number = 100, action: string | null = null): Promise<AuditEntryRow[]> {
    return this._repository.findRecent(limit, action);
  }
}
