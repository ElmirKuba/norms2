import type { TodoView } from '../accent.types';

/**
 * Готовит строку к сравнению: регистр и края не должны влиять на поиск.
 * @param value Исходная строка.
 * @returns Нормализованная строка.
 */
function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU');
}

/**
 * Совпадает ли сама запись — по заголовку или заметке.
 *
 * Заметка участвует наравне с заголовком: человек пишет туда то, что не поместилось в строку
 * («взять паспорт и СНИЛС»), и искать «снилс» он будет именно так, а не по названию дела.
 * @param item Запись.
 * @param needle Нормализованный запрос.
 * @returns `true`, если запись сама попадает под запрос.
 */
function matches(item: TodoView, needle: string): boolean {
  if (normalize(item.title).includes(needle)) {
    return true;
  }
  return item.note !== null && normalize(item.note).includes(needle);
}

/**
 * Фильтрует дерево записей по строке поиска (·E2).
 *
 * Два правила, и оба про контекст:
 *
 * 1. **Совпал родитель — показываем его целиком, вместе с подзадачами.** Дело «Загранник» с
 *    четырьмя шагами внутри полезно видеть как есть; выкусывать из него подзадачи, не совпавшие
 *    со строкой, значило бы врать про состав дела.
 * 2. **Совпала подзадача — показываем её вместе с родителем.** Подзадача «сдать документы» без
 *    родителя не отвечает на вопрос «к чему это»; сиблинги, не попавшие в запрос, при этом
 *    прячутся — иначе поиск ничего не сужает.
 *
 * Пустой запрос возвращает дерево как есть — не копию: лишние пересборки заставили бы Angular
 * перерисовывать список на каждое нажатие клавиши.
 * @param rows Записи уровня.
 * @param query Строка поиска (сырая, ненормализованная).
 * @returns Отфильтрованное дерево.
 */
export function filterTodos(rows: TodoView[], query: string): TodoView[] {
  const needle = normalize(query);
  if (needle === '') {
    return rows;
  }
  return filterLevel(rows, needle);
}

/**
 * Рекурсивная часть фильтра.
 * @param rows Записи уровня.
 * @param needle Нормализованный запрос.
 * @returns Отфильтрованный уровень.
 */
function filterLevel(rows: TodoView[], needle: string): TodoView[] {
  const kept: TodoView[] = [];
  for (const row of rows) {
    if (matches(row, needle)) {
      kept.push(row);
      continue;
    }
    const children = filterLevel(row.children, needle);
    if (children.length > 0) {
      kept.push({ ...row, children });
    }
  }
  return kept;
}

/**
 * Сколько записей осталось после фильтра, считая подзадачи.
 *
 * Нужно для подписи результата: «ничего не нашлось» решается по этому числу, а не по длине
 * корневого уровня — корень мог остаться единственным носителем совпавшей подзадачи.
 * @param rows Отфильтрованное дерево.
 * @returns Число записей на всех уровнях.
 */
export function countTodos(rows: TodoView[]): number {
  return rows.reduce((sum, row) => sum + 1 + countTodos(row.children), 0);
}
