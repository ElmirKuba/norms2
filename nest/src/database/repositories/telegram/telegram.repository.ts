import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase, DrizzleExecutor } from '../../client/database.constants';
import type { Transaction } from '../../../shared/transactions/transaction.interface';
import { telegramRequests } from '../../schemas/telegram-requests.schema';
import { telegramLinks } from '../../schemas/telegram-links.schema';
import { telegramUpdates } from '../../schemas/telegram-updates.schema';
import type {
  TelegramRepositoryPort,
  TelegramRequestDecision,
} from '../../../modules/telegram/adapters/telegram-repository.port';
import type { TelegramLinkFull } from '../../../modules/telegram/interfaces/telegram-link-full.interface';
import type { TelegramRequestBase } from '../../../modules/telegram/interfaces/telegram-request-base.interface';
import type { TelegramRequestFull } from '../../../modules/telegram/interfaces/telegram-request-full.interface';
import type { TelegramRequestStatus } from '../../../modules/telegram/interfaces/telegram-request-pure.interface';

/**
 * Drizzle-реализация порта Telegram-области: заявки и привязки аккаунтов к чатам (2.9.1·8).
 */
@Injectable()
export class TelegramRepository implements TelegramRepositoryPort {
  /**
   * @param _db Инстанс Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Отмечает апдейт обработанным.
   * @param updateId `update_id` из Bot API.
   * @returns `true`, если апдейт видим впервые.
   */
  public async markUpdateProcessed(updateId: number): Promise<boolean> {
    const rows = await this._db
      .insert(telegramUpdates)
      .values({ updateId })
      .onConflictDoNothing({ target: telegramUpdates.updateId })
      .returning({ updateId: telegramUpdates.updateId });
    return rows.length > 0;
  }

  /**
   * Создаёт заявку.
   * @param id Идентификатор.
   * @param data Карточка заявки.
   * @returns Созданная строка.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async createRequest(id: string, data: TelegramRequestBase): Promise<TelegramRequestFull> {
    const rows = await this._db.insert(telegramRequests).values({ id, ...data }).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT telegram_requests не вернул строку.');
    }
    return row;
  }

  /**
   * Запоминает id сообщения-карточки в личке владельца.
   * @param id Заявка.
   * @param messageId Сообщение.
   * @returns Промис завершения.
   */
  public async setRequestOwnerMessage(id: string, messageId: number): Promise<void> {
    await this._db
      .update(telegramRequests)
      .set({ ownerMessageId: messageId })
      .where(eq(telegramRequests.id, id));
  }

  /**
   * Незакрытая заявка этого чата.
   * @param chatId Чат заявителя.
   * @returns Заявка или null.
   */
  public async findPendingByChat(chatId: string): Promise<TelegramRequestFull | null> {
    const rows = await this._db
      .select()
      .from(telegramRequests)
      .where(and(eq(telegramRequests.chatId, chatId), eq(telegramRequests.status, 'pending')))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Заявка по идентификатору.
   * @param id Идентификатор.
   * @returns Заявка или null.
   */
  public async findRequestById(id: string): Promise<TelegramRequestFull | null> {
    const rows = await this._db
      .select()
      .from(telegramRequests)
      .where(eq(telegramRequests.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Очередь заявок по статусу, новые сверху.
   * @param status Статус.
   * @param limit Сколько.
   * @param offset Сдвиг.
   * @returns Заявки.
   */
  public async listRequestsByStatus(
    status: TelegramRequestStatus,
    limit: number,
    offset: number,
  ): Promise<TelegramRequestFull[]> {
    return this._db
      .select()
      .from(telegramRequests)
      .where(eq(telegramRequests.status, status))
      .orderBy(desc(telegramRequests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Количество заявок в статусе.
   * @param status Статус.
   * @returns Количество.
   */
  public async countRequestsByStatus(status: TelegramRequestStatus): Promise<number> {
    const rows = await this._db
      .select({ value: count() })
      .from(telegramRequests)
      .where(eq(telegramRequests.status, status));
    return rows[0]?.value ?? 0;
  }

  /**
   * Закрывает заявку, если она ещё `pending`.
   * @param id Заявка.
   * @param decision Решение.
   * @returns `true`, если закрыли именно сейчас.
   */
  public async decideIfPending(
    id: string,
    decision: TelegramRequestDecision,
    tx?: Transaction,
  ): Promise<boolean> {
    // Условие `status = 'pending'` в самом UPDATE: решение приходит и с кнопки под сообщением,
    // и из списка очереди, поэтому «прочитали → проверили → записали» пропускает второй апрув.
    const rows = await this._exec(tx)
      .update(telegramRequests)
      .set({ ...decision, decidedAt: new Date() })
      .where(and(eq(telegramRequests.id, id), eq(telegramRequests.status, 'pending')))
      .returning({ id: telegramRequests.id });
    return rows.length > 0;
  }

  /**
   * Помечает протухшими незакрытые заявки старше срока.
   * @param olderThan Граница.
   * @returns Сколько помечено.
   */
  public async expirePendingOlderThan(olderThan: Date): Promise<number> {
    const rows = await this._db
      .update(telegramRequests)
      .set({ status: 'expired', decidedAt: new Date() })
      .where(
        and(eq(telegramRequests.status, 'pending'), lt(telegramRequests.createdAt, olderThan)),
      )
      .returning({ id: telegramRequests.id });
    return rows.length;
  }

  /**
   * Привязка по чату.
   * @param chatId Чат.
   * @returns Привязка или null.
   */
  public async findLinkByChat(chatId: string): Promise<TelegramLinkFull | null> {
    const rows = await this._db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Привязка по аккаунту.
   * @param accountId Аккаунт.
   * @returns Привязка или null.
   */
  public async findLinkByAccount(accountId: string): Promise<TelegramLinkFull | null> {
    const rows = await this._db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.accountId, accountId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт привязку.
   * @param id Идентификатор.
   * @param accountId Аккаунт.
   * @param chatId Чат.
   * @returns Созданная привязка.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async createLink(id: string, accountId: string, chatId: string): Promise<TelegramLinkFull> {
    const rows = await this._db.insert(telegramLinks).values({ id, accountId, chatId }).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT telegram_links не вернул строку.');
    }
    return row;
  }

  /**
   * Меняет согласие на уведомления.
   * @param chatId Чат.
   * @param allowed Разрешено ли писать.
   * @returns Промис завершения.
   */
  public async setNotificationsAllowed(chatId: string, allowed: boolean): Promise<void> {
    await this._db
      .update(telegramLinks)
      .set({ notificationsAllowed: allowed })
      .where(eq(telegramLinks.chatId, chatId));
  }

  /**
   * Удаляет привязку.
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  public async deleteLinkByChat(chatId: string): Promise<void> {
    await this._db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
  }

  /**
   * Разрешает исполнителя: переданная транзакция или дефолтный инстанс БД.
   * @param tx Опц. опаковая транзакция.
   * @returns DrizzleExecutor.
   */
  private _exec(tx?: Transaction): DrizzleExecutor {
    return tx === undefined ? this._db : (tx as unknown as DrizzleExecutor);
  }
}
