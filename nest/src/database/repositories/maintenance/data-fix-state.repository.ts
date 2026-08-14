import { Inject, Injectable } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import { appSettings } from '../../schemas/app-settings.schema';
import { accounts } from '../../schemas/accounts.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { DrizzleDatabase } from '../../client/database.constants';
import type { DataFixStatePort } from '../../../modules/maintenance/adapters/data-fix-state.port';

/** Префикс ключей отметок, чтобы починки не смешивались с настройками продукта. */
const PREFIX = 'datafix.';

/** Drizzle-реализация порта состояния разовых починок (2.9.3·25). */
@Injectable()
export class DataFixStateRepository implements DataFixStatePort {
  /**
   * @param _db Клиент Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Отработала ли починка.
   * @param key Ключ починки.
   * @returns true, если отметка стоит.
   */
  public async isDone(key: string): Promise<boolean> {
    const rows = await this._db
      .select({ key: appSettings.key })
      .from(appSettings)
      .where(eq(appSettings.key, `${PREFIX}${key}`))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Ставит отметку с меткой времени в значении — по ней потом видно, когда прогон был.
   * @param key Ключ починки.
   * @returns Промис завершения.
   */
  public async markDone(key: string): Promise<void> {
    await this._db
      .insert(appSettings)
      .values({ id: generateId(), key: `${PREFIX}${key}`, value: new Date().toISOString() })
      .onConflictDoNothing();
  }

  /**
   * Живые аккаунты.
   * @returns Идентификаторы.
   */
  public async listAccountIds(): Promise<string[]> {
    const rows = await this._db
      .select({ id: accounts.id })
      .from(accounts)
      .where(isNull(accounts.deletedAt));
    return rows.map((row) => row.id);
  }
}
