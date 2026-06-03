import { index, pgTable, text } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';

/**
 * secret_qa — вопросы восстановления (1:N к accounts). Ответ хранится хешем
 * (argon2id), нормализованным перед хешированием.
 */
export const secretQa = pgTable(
  'secret_qa',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    question: text('question').notNull(),
    answerHash: text('answer_hash').notNull(),
    ...timestamps(),
  },
  (table) => [index('secret_qa_account_id_idx').on(table.accountId)],
);
