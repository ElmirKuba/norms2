import type { TodoEventView, TodoView } from '../accent.types';

/** Ключ группы списка. */
export type TodoGroupKey =
  | 'overdue'
  | 'today'
  | 'soon'
  | 'later'
  | 'waiting'
  | 'someday'
  | 'done';

/** Группа списка: заголовок и записи в порядке показа. */
export interface TodoGroup {
  /** Ключ — для `track` в шаблоне и для адресации при перетаскивании. */
  key: TodoGroupKey;
  /** Заголовок над группой. */
  title: string;
  /** Записи группы; порядок — тот, что пришёл с сервера (позиция). */
  items: TodoView[];
}

/**
 * Порядок групп сверху вниз — он же смысл экрана: сначала то, что просят внимания сегодня,
 * потом будущее, потом заблокированное чужим действием, и только затем «когда-нибудь».
 *
 * **«Просрочено» стоит первым, но не кричит** (ADR-0049):
 * ни красного цвета, ни счётчика — продукт напоминает, а не выставляет счёт.
 */
const GROUP_TITLES: ReadonlyArray<readonly [TodoGroupKey, string]> = [
  ['overdue', 'Просрочено'],
  ['today', 'Сегодня'],
  ['soon', 'Скоро'],
  ['later', 'Позже'],
  ['waiting', 'Ждут'],
  ['someday', 'Без даты'],
  ['done', 'Сделано'],
];

/** Горизонт группы «Скоро» в днях: дальше — «Позже». */
const SOON_DAYS = 7;

/**
 * Сегодняшний день устройства в формате `YYYY-MM-DD`.
 *
 * Собирается из локальных частей даты, а не через `toISOString()`: тот отдаёт UTC, и при
 * положительном смещении «сегодня» вечером превращается в завтра.
 * @returns День в формате `YYYY-MM-DD`.
 */
export function todayYmd(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/**
 * Сдвигает день на N суток вперёд.
 * @param ymd День в формате `YYYY-MM-DD`.
 * @param days Сколько суток прибавить.
 * @returns День в том же формате.
 */
export function shiftDay(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return ymd;
  }
  const shifted = new Date(year, month - 1, day + days);
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  const nextDay = String(shifted.getDate()).padStart(2, '0');
  return `${String(shifted.getFullYear())}-${nextMonth}-${nextDay}`;
}

/**
 * Ждёт ли запись чужого действия **прямо сейчас**.
 *
 * Ожидание перестаёт быть ожиданием само: событие состоялось или дата «не раньше» наступила —
 * и дело возвращается в обычные группы. Иначе список копил бы вечные «ждут», из которых надо
 * выковыривать руками то, что уже можно делать.
 *
 * Событие, которого нет в справочнике, считаем **не состоявшимся**: справочник приходит вместе
 * с состоявшимися, и его молчание значит «ещё не загрузился», а не «уже случилось». Ошибиться
 * в эту сторону дешевле — дело подождёт лишнюю секунду, а не пропадёт из виду.
 * @param item Запись.
 * @param events Справочник событий.
 * @param today Сегодняшний день `YYYY-MM-DD`.
 * @returns `true`, если дело заблокировано ожиданием.
 */
function isWaiting(item: TodoView, events: TodoEventView[], today: string): boolean {
  if (item.waitsUntil !== null && item.waitsUntil > today) {
    return true;
  }
  if (item.waitsForEventId === null) {
    return false;
  }
  const event = events.find((row) => row.id === item.waitsForEventId);
  return event === undefined || event.happenedAt === null;
}

/**
 * К какой группе относится запись.
 * @param item Запись.
 * @param events Справочник событий.
 * @param today Сегодняшний день `YYYY-MM-DD`.
 * @returns Ключ группы.
 */
export function groupOf(item: TodoView, events: TodoEventView[], today: string): TodoGroupKey {
  if (item.status === 'done') {
    return 'done';
  }
  // Ожидание сильнее даты: дело, которое упирается в чужое действие, человек сегодня не сделает,
  // и держать его среди «Сегодня» — врать про свой же список.
  if (isWaiting(item, events, today)) {
    return 'waiting';
  }
  const planned = item.plannedOn;
  if (planned === null) {
    return 'someday';
  }
  if (planned < today) {
    return 'overdue';
  }
  if (planned === today) {
    return 'today';
  }
  return planned <= shiftDay(today, SOON_DAYS) ? 'soon' : 'later';
}

/**
 * Раскладывает корневые записи по группам.
 *
 * **Зачем шаг ·E1.** До него `plannedOn` и `waitsUntil` записывались, показывались на строке и
 * ни на что не влияли: выборка шла по `status`/`position`, и дело «на завтра» лежало вперемешку
 * с делом «когда-нибудь». Продукт спрашивал дату и ничего с ней не делал — тот же класс дефекта,
 * что поле без потребителя, только на уровне поведения.
 *
 * Группировка живёт на фронте: сервер уже отдаёт все нужные поля, и ради раскладки заводить
 * новый контракт незачем. Порядок внутри группы — тот, что пришёл с сервера, поэтому
 * перетаскивание продолжает работать (в пределах группы).
 *
 * Пустые группы не возвращаются: заголовок над пустотой — шум, а «Просрочено (0)» ещё и
 * напоминание о том, чего нет.
 * @param items Корневые записи в серверном порядке.
 * @param events Справочник событий.
 * @param today Сегодняшний день `YYYY-MM-DD`.
 * @returns Непустые группы в порядке показа.
 */
export function groupTodos(
  items: TodoView[],
  events: TodoEventView[],
  today: string,
): TodoGroup[] {
  const buckets = new Map<TodoGroupKey, TodoView[]>();
  for (const item of items) {
    const key = groupOf(item, events, today);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }
  return GROUP_TITLES.filter(([key]) => (buckets.get(key)?.length ?? 0) > 0).map(
    ([key, title]) => ({ key, title, items: buckets.get(key) ?? [] }),
  );
}
