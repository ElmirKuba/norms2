import { Injectable } from '@nestjs/common';
import { AuditDomainService } from '../../audit/domain-services/audit.domain-service';
import type { AuditEntryView } from '../interfaces/audit-entry-view.interface';

/** Сколько записей отдаём по умолчанию и максимум за один запрос. */
export const DEFAULT_AUDIT_LIMIT = 100;
export const MAX_AUDIT_LIMIT = 500;

/**
 * Чтение журнала действий (2.9.3·14).
 *
 * Use-case тонкий намеренно: вся работа с журналом живёт в `AuditDomainService`, здесь — только
 * потолок выборки и проекция наружу. **Ручек «изменить» и «удалить» тут нет и не будет** — их
 * нет даже в порте репозитория (·6): журнал, умеющий править себя, не доказывает ничего.
 */
@Injectable()
export class ReadAuditLogUseCase {
  /**
   * @param _audit Журнал действий.
   */
  public constructor(private readonly _audit: AuditDomainService) {}

  /**
   * Последние записи журнала, новые сверху.
   * @param limit Сколько записей вернуть.
   * @param action Код действия для фильтра или `null` — тогда все подряд.
   * @returns Строки для экрана.
   */
  public async execute(limit: number, action: string | null): Promise<AuditEntryView[]> {
    const entries = await this._audit.recent(this._limit(limit), action);

    return entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      actorLogin: entry.actorLogin,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetLabel: entry.targetLabel,
      details: entry.details,
      targetAlive: entry.targetAlive,
      actorAlive: entry.actorAlive,
    }));
  }

  /**
   * Приводит запрошенный размер выборки к разумному.
   * @param value Что пришло.
   * @returns Размер выборки.
   */
  private _limit(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_AUDIT_LIMIT;
    }
    return Math.min(Math.trunc(value), MAX_AUDIT_LIMIT);
  }
}
