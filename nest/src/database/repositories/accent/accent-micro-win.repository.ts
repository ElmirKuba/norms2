import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { microWins } from '../../schemas/micro-wins.schema';
import { microWinLogs } from '../../schemas/micro-win-logs.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentMicroWinRepositoryPort,
  MicroWinCreateData,
  MicroWinUpdateData,
} from '../../../modules/accent/micro-wins/adapters/accent-micro-win-repository.port';
import type { MicroWinFull } from '../../../modules/accent/micro-wins/interfaces/micro-win-full.interface';

/**
 * Drizzle-реализация порта микро-побед (единственное место с ORM). Строка `micro_wins`
 * структурно совпадает с `MicroWinFull` (колонки 1:1) → маппинг прямой. Все запросы
 * скоупятся по `account_id` (владение). Биндится на `ACCENT_MICRO_WIN_REPOSITORY`.
 */
@Injectable()
export class AccentMicroWinRepository implements AccentMicroWinRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Активные микро-победы аккаунта по дате создания.
   * @param accountId Идентификатор аккаунта.
   * @returns Список микро-побед владельца.
   */
  public async listByAccount(accountId: string): Promise<MicroWinFull[]> {
    return this._db
      .select()
      .from(microWins)
      .where(and(eq(microWins.accountId, accountId), eq(microWins.isActive, true)))
      .orderBy(asc(microWins.createdAt));
  }

  /**
   * Находит микро-победу по id с проверкой владения.
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  public async findOwned(id: string, accountId: string): Promise<MicroWinFull | null> {
    const rows = await this._db
      .select()
      .from(microWins)
      .where(and(eq(microWins.id, id), eq(microWins.accountId, accountId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт микро-победу (id — `generateId()`).
   * @param data Данные создания.
   * @returns Созданная микро-победа.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: MicroWinCreateData): Promise<MicroWinFull> {
    const rows = await this._db
      .insert(microWins)
      .values({
        id: generateId(),
        accountId: data.accountId,
        title: data.title,
        category: data.category,
        durationSeconds: data.durationSeconds,
        energyCost: data.energyCost,
        effect: data.effect ?? null,
        disabledForStates: data.disabledForStates ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('micro_wins: create не вернул строку.');
    }
    return row;
  }

  /**
   * Обновляет микро-победу владельца (только переданные поля).
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  public async update(
    id: string,
    accountId: string,
    patch: MicroWinUpdateData,
  ): Promise<MicroWinFull | null> {
    const rows = await this._db
      .update(microWins)
      .set(patch)
      .where(and(eq(microWins.id, id), eq(microWins.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Удаляет микро-победу владельца (логи каскадятся по FK).
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns true если удалено.
   */
  public async remove(id: string, accountId: string): Promise<boolean> {
    const rows = await this._db
      .delete(microWins)
      .where(and(eq(microWins.id, id), eq(microWins.accountId, accountId)))
      .returning({ id: microWins.id });
    return rows.length > 0;
  }

  /**
   * Идемпотентный лог выполнения за день (ON CONFLICT по `(micro_win_id, occurred_on)`).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param microWinId Идентификатор микро-победы.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns true если лог создан впервые, false если уже был (no-op).
   */
  public async logCompletion(
    accountId: string,
    microWinId: string,
    occurredOn: string,
  ): Promise<boolean> {
    const rows = await this._db
      .insert(microWinLogs)
      .values({ id: generateId(), accountId, microWinId, occurredOn })
      .onConflictDoNothing()
      .returning({ id: microWinLogs.id });
    return rows.length > 0;
  }

  /**
   * Идентификаторы микро-побед, по которым есть лог за указанный день.
   * @param accountId Идентификатор аккаунта.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns Список `microWinId`.
   */
  public async listLoggedOn(accountId: string, occurredOn: string): Promise<string[]> {
    const rows = await this._db
      .select({ microWinId: microWinLogs.microWinId })
      .from(microWinLogs)
      .where(and(eq(microWinLogs.accountId, accountId), eq(microWinLogs.occurredOn, occurredOn)));
    return rows.map((row) => row.microWinId);
  }
}
