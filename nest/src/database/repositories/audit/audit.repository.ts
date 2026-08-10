import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { adminAuditLog } from '../../schemas/admin-audit-log.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { AuditRepositoryPort } from '../../../modules/audit/adapters/audit-repository.port';
import type { AuditEntryBase } from '../../../modules/audit/interfaces/audit-entry-base.interface';
import type { AuditEntryFull } from '../../../modules/audit/interfaces/audit-entry-full.interface';

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
   * @returns Строки журнала.
   */
  public async findRecent(limit: number): Promise<AuditEntryFull[]> {
    return this._database
      .select()
      .from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
      .limit(limit);
  }
}
