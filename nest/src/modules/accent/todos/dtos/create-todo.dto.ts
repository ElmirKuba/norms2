import { z } from 'zod';
import { TODO_KINDS } from '../interfaces/todo-full.interface';

/** Формат дня — `YYYY-MM-DD`. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Схема тела `POST /accent/todos` (closed-shape, `.strict` — лишние поля отвергаются).
 *
 * **Обязателен только заголовок.** Это не упущение, а суть фичи: продукт уже имеет форму, где
 * дата и вид обязательны, и ею не воспользовались ни разу за два с половиной месяца. Всё
 * остальное — по желанию и потом.
 *
 * Нормализация (trim) — в domain-service, как везде.
 */
export const createTodoSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(200, 'Название: максимум 200.'),
    kind: z.enum(TODO_KINDS),
    parentId: z.string().max(52).nullish(),
    note: z.string().max(4000, 'Заметка: максимум 4000.').nullish(),
    plannedOn: z.string().regex(DAY_PATTERN, 'Дата: формат YYYY-MM-DD.').nullish(),
    waitsForEventId: z.string().max(52).nullish(),
    waitsUntil: z.string().regex(DAY_PATTERN, 'Дата: формат YYYY-MM-DD.').nullish(),
    badge: z.string().max(64, 'Метка: максимум 64.').nullish(),
  })
  .strict();

/** Тело создания записи. */
export type CreateTodoDto = z.infer<typeof createTodoSchema>;

/** Схема тела `PATCH /accent/todos/:id` — те же поля, все необязательные. */
export const updateTodoSchema = createTodoSchema.partial().omit({ parentId: true }).strict();

/**
 * Тело правки записи. `parentId` исключён намеренно: переезд подзадачи к другому родителю —
 * отдельная операция со своими правилами (глубина, циклы), а не поле формы.
 */
export type UpdateTodoDto = z.infer<typeof updateTodoSchema>;

/** Схема тела `PUT /accent/todos/reorder`. */
export const reorderTodosSchema = z
  .object({
    ids: z.array(z.string().max(52)).min(1, 'Нужен хотя бы один идентификатор.'),
  })
  .strict();

/** Тело перестановки. */
export type ReorderTodosDto = z.infer<typeof reorderTodosSchema>;

/** Схема тела `POST /accent/todo-events`. */
export const createTodoEventSchema = z
  .object({
    title: z.string().min(1, 'Название обязательно.').max(200, 'Название: максимум 200.'),
    // Событие бывает и без даты — «когда позвонят»: у ожидания есть адрес, но нет срока.
    expectedOn: z.string().regex(DAY_PATTERN, 'Дата: формат YYYY-MM-DD.').nullish(),
  })
  .strict();

/** Тело создания события. */
export type CreateTodoEventDto = z.infer<typeof createTodoEventSchema>;

/** Схема тела `PATCH /accent/todo-events/:id`. */
export const updateTodoEventSchema = createTodoEventSchema.partial().strict();

/** Тело правки события. */
export type UpdateTodoEventDto = z.infer<typeof updateTodoEventSchema>;
