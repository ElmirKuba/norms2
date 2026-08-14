import { Inject, Injectable } from '@nestjs/common';
import { accounts } from '../../schemas/accounts.schema';
import { alias } from 'drizzle-orm/pg-core';
import { alive } from '../../core/alive.util';

/** Второй экземпляр `accounts` — для join-а по действовавшему (у join-ов должны быть разные имена). */
const actorAccounts = alias(accounts, 'actor_accounts');
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { adminAuditLog } from '../../schemas/admin-audit-log.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { AuditRepositoryPort } from '../../../modules/audit/adapters/audit-repository.port';
import type { AuditEntryBase } from '../../../modules/audit/interfaces/audit-entry-base.interface';
import type { AuditEntryFull } from '../../../modules/audit/interfaces/audit-entry-full.interface';
import type { AuditEntryRow } from '../../../modules/audit/interfaces/audit-entry-row.interface';

/** Drizzle-реализация порта журнала действий администратора (2.9.3·6). */
@Injectable()
export class AuditRepository implements AuditRepositoryPort {
  /**
   * @param _database Клиент Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _database: DrizzleDatabase) {}

  /**
   * Дописывает запись в журнал.
   * @param entry Содержательные поля записи.
   * @returns Сохранённая строка.
   */
  public async append(entry: AuditEntryBase): Promise<AuditEntryFull> {
    const [row] = await this._database
      .insert(adminAuditLog)
      .values({ id: generateId(), ...entry })
      .returning();
    if (row === undefined) {
      // Недостижимо: insert с returning всегда отдаёт строку. Проверка нужна типам, не логике.
      throw new Error(`Запись журнала '${entry.action}' не сохранилась`);
    }
    return row;
  }

  /**
   * Читает последние записи, новые сверху.
   *
   * Порядок по `created_at`, а вторым ключом по `id`: у двух записей одной транзакции метка
   * времени совпадает до микросекунды, и без второго ключа их порядок между запросами плавал бы.
   * `id` начинается с uuidv7, поэтому монотонен по времени создания.
   *
   * @param limit Сколько записей вернуть.
   * @param action Код действия для фильтра или `null` — тогда все подряд.
   * @returns Строки журнала.
   */
  public async findRecent(limit: number, action: string | null): Promise<AuditEntryRow[]> {
    const rows = await this._database
      .select({
        id: adminAuditLog.id,
        createdAt: adminAuditLog.createdAt,
        actorAccountId: adminAuditLog.actorAccountId,
        actorLogin: adminAuditLog.actorLogin,
        action: adminAuditLog.action,
        targetType: adminAuditLog.targetType,
        targetId: adminAuditLog.targetId,
        targetLabel: adminAuditLog.targetLabel,
        details: adminAuditLog.details,
        // Живы ли аккаунты, о которых запись. `left join` по идентификаторам, а не по логинам:
        // логин с 2.9.3·29.1 освобождается и может принадлежать уже другому человеку (ADR-0017).
        targetAccountId: accounts.id,
        actorAccountAlive: actorAccounts.id,
      })
      .from(adminAuditLog)
      .leftJoin(accounts, and(eq(accounts.id, adminAuditLog.targetId), alive(accounts)))
      .leftJoin(
        actorAccounts,
        and(eq(actorAccounts.id, adminAuditLog.actorAccountId), alive(actorAccounts)),
      )
      .where(action === null ? undefined : eq(adminAuditLog.action, action))
      .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
      .limit(limit);

    return rows.map(({ targetAccountId, actorAccountAlive, ...entry }) => ({
      ...entry,
      targetAlive: entry.targetType === 'account' ? targetAccountId !== null : null,
      // У системных записей актёра нет вовсе — там `null`, а не «удалён».
      actorAlive: entry.actorAccountId === null ? null : actorAccountAlive !== null,
    }));
  }
}
