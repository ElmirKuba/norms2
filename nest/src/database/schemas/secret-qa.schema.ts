import { index, text } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { SecretQaFull } from '../../modules/auth/interfaces/secret-qa-full.interface';

/**
 * secret_qa — вопросы восстановления (1:N к accounts). Колонки проверяются TS
 * на 1:1 с SecretQaFull. Ответ — argon2id-хеш нормализованного ответа.
 */
export const secretQa = defineTableWithSchema<SecretQaFull>()(
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
