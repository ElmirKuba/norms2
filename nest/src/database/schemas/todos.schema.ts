import { date, index, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  TodoFull,
  TodoKind,
  TodoStatus,
} from '../../modules/accent/todos/interfaces/todo-full.interface';

/**
 * todos — записи списка дел (per-account; колонки 1:1 с `TodoFull`).
 *
 * **Отдельная таблица, а не расширение `tasks`** (реш. Elmir 15.08.2026). Соблазн был: сделать
 * `occurred_on` необязательным, и задача без дня — это запись. Не годится: задачи удаляются
 * **физически** (`paranoid: false`) с обоснованием «материализация шаблона на день, **а не данные
 * человека**». Запись, сделанная из головы, — именно данные человека, и мягкое удаление ей
 * положено.
 *
 * **Мягкое удаление и архив — разное** (ADR-0068): `deleted_at` вешает хелпер определения таблицы,
 * `archived_at` — состояние продукта с путём назад.
 *
 * **`parent_id` — рекурсия на себя**, потому что подзадача является полноценной записью: со своим
 * статусом, датой и ожиданием. Ссылка мягкая, без FK на себя же: каскад у нас свой, рекурсивный,
 * по карте владения (`database/core/deletion-graph.ts`), а `ON DELETE CASCADE` в базе нет ни
 * одного.
 */
export const todos = defineTableWithSchema<TodoFull>()(
  'todos',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id),
    parentId: fkColumn('parent_id'),
    kind: varchar('kind', { length: 16 }).$type<TodoKind>().notNull(),
    title: text('title').notNull(),
    note: text('note'),
    status: varchar('status', { length: 16 }).$type<TodoStatus>().notNull().default('open'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // День хранится строкой, как `occurred_on` у дневных сущностей: однажды приписанный день не
    // должен меняться от смены часового пояса (ADR-0069 → дополнение про пояса; 2.10·A4).
    plannedOn: date('planned_on', { mode: 'string' }),
    // Мягкая ссылка на `todo_events.id`: читатель обязан проверять живость (ADR-0068).
    waitsForEventId: fkColumn('waits_for_event_id'),
    waitsUntil: date('waits_until', { mode: 'string' }),
    badge: varchar('badge', { length: 64 }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    // Список открывается всегда по владельцу и виду — самый частый запрос экрана.
    index('todos_account_kind_idx').on(table.accountId, table.kind),
    // Подзадачи читаются пачкой по родителю.
    index('todos_parent_idx').on(table.parentId),
  ],
);
