import { index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sessions } from './sessions.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { SessionTokenHistoryFull } from '../../modules/sessions/interfaces/session-token-history-full.interface';

/**
 * session_token_history — архив ротированных хешей refresh-токенов (колонки 1:1 с
 * SessionTokenHistoryFull). Append-only: при ротации старый хеш падает сюда. Если
 * предъявлен токен, чей хеш есть здесь, — это реплей уже ротированного токена →
 * reuse-detect (отзыв всех сессий аккаунта, ADR-0046/0035). Без меток-update
 * (запись неизменяема) — потому НЕ `timestamps()`, только created_at.
 */
export const sessionTokenHistory = defineTableWithSchema<SessionTokenHistoryFull>()(
  'session_token_history',
  {
    id: idColumn(),
    sessionId: fkColumn('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('session_token_history_token_hash_unique').on(table.tokenHash),
    index('session_token_history_session_id_idx').on(table.sessionId),
  ],
);
