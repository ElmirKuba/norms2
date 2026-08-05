import { bigint, index, timestamp } from 'drizzle-orm/pg-core';
import { defineTableWithSchema } from './define-table.helper';
import type { TelegramUpdateLogFull } from '../../modules/telegram/interfaces/telegram-update-log-full.interface';

/**
 * telegram_updates — журнал обработанных апдейтов (2.9.1·9), защита от повторной доставки.
 *
 * `update_id` сам себе PK: вставка с `ON CONFLICT DO NOTHING` и есть проверка «первый раз или
 * повтор», и она атомарна. Отдельного `id` формата `uuidv7___unixmillis` тут нет намеренно —
 * это не сущность продукта, а техническая отметка, и ключ ей задаёт внешняя система.
 */
export const telegramUpdates = defineTableWithSchema<TelegramUpdateLogFull>()(
  'telegram_updates',
  {
    updateId: bigint('update_id', { mode: 'number' }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('telegram_updates_created_at_idx').on(table.createdAt)],
);
