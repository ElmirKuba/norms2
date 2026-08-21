import { shiftDay } from './todo-groups.util';

/** Что дал разбор строки: очищенный заголовок, день и распознанный кусок. */
export interface ParsedDate {
  /** Заголовок без куска про дату. */
  title: string;
  /** День `YYYY-MM-DD`. */
  plannedOn: string;
  /** Что именно было распознано — чтобы показать человеку, с чем он соглашается. */
  matched: string;
}

/** Дни недели в формах, которые реально пишут: «в пятницу», «во вторник», «пятница». */
const WEEKDAYS: ReadonlyArray<readonly [number, string]> = [
  [1, 'понедельник'],
  [2, 'вторник'],
  [3, 'сред'],
  [4, 'четверг'],
  [5, 'пятниц'],
  [6, 'суббот'],
  [0, 'воскресень'],
];

/** Месяцы по корню слова: «сентября», «сентябре», «сент». */
const MONTHS: readonly string[] = [
  'январ',
  'феврал',
  'март',
  'апрел',
  'ма',
  'июн',
  'июл',
  'август',
  'сентябр',
  'октябр',
  'ноябр',
  'декабр',
];

/**
 * Собирает день из частей в формате `YYYY-MM-DD`.
 * @param year Год.
 * @param month Месяц (1–12).
 * @param day День месяца.
 * @returns День в формате `YYYY-MM-DD`.
 */
function ymd(year: number, month: number, day: number): string {
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Существует ли такая дата (31 февраля быть не должно).
 * @param year Год.
 * @param month Месяц (1–12).
 * @param day День месяца.
 * @returns `true`, если дата реальна.
 */
function isRealDate(year: number, month: number, day: number): boolean {
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/**
 * День недели указанного дня (0 — воскресенье).
 * @param iso День `YYYY-MM-DD`.
 * @returns Номер дня недели.
 */
function weekdayOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getDay();
}

/**
 * Убирает распознанный кусок и приводит пробелы в порядок.
 * @param title Исходный заголовок.
 * @param matched Найденный кусок.
 * @returns Заголовок без куска.
 */
function cut(title: string, matched: string): string {
  return title.replace(matched, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Ищет в заголовке указание на день и вынимает его (·E4).
 *
 * **Зачем.** Дата в «Делах» проставляется через модалку деталей — три клика на запись, которую
 * человек хотел бросить в список одной строкой. Пока порог такой, `plannedOn` останется пустым
 * у большинства записей, и группы ·E1 будут раскладывать пустоту.
 *
 * **Разбор ошибается, и это заложено:** распознанное показывается отдельной пометкой, снимаемой
 * одним кликом. Поэтому здесь допустимы жадные правила — цена ошибки один клик, а не испорченная
 * запись.
 *
 * **Чего тут сознательно нет:** времени суток (в модели день, а не момент) и синтаксиса
 * проектов/тегов вроде `#дом` или `p1` — такое надо помнить, а продукт не про запоминание
 * синтаксиса.
 *
 * Если после вырезания заголовок пуст («завтра» целиком), разбор не применяется: запись без
 * названия хуже записи без даты.
 * @param rawTitle Заголовок, как его набрал человек.
 * @param today Сегодняшний день `YYYY-MM-DD`.
 * @returns Разбор или `null`, если даты не видно.
 */
export function parseDateFromTitle(rawTitle: string, today: string): ParsedDate | null {
  const found = findDate(rawTitle, today);
  if (found === null) {
    return null;
  }
  const title = cut(rawTitle, found.matched);
  if (title === '') {
    return null;
  }
  return { title, plannedOn: found.plannedOn, matched: found.matched.trim() };
}

/**
 * Собственно поиск даты — по правилам, от самых однозначных к самым общим.
 * @param raw Заголовок.
 * @param today Сегодняшний день.
 * @returns День и найденный кусок либо `null`.
 */
function findDate(raw: string, today: string): { plannedOn: string; matched: string } | null {
  const text = raw.toLocaleLowerCase('ru-RU');
  const year = Number(today.slice(0, 4));

  // «15.09.2026», «15.09», «15/09» — самое однозначное, поэтому первым.
  const numeric = /(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const rawYear = numeric[3];
    const explicitYear =
      rawYear === undefined ? null : Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
    if (month >= 1 && month <= 12 && isRealDate(explicitYear ?? year, month, day)) {
      const candidate = ymd(explicitYear ?? year, month, day);
      // Без года берём ближайшую будущую: «15.01», написанное в декабре, — это январь следующего.
      const resolved =
        explicitYear === null && candidate < today ? ymd(year + 1, month, day) : candidate;
      return { plannedOn: resolved, matched: numeric[0] };
    }
  }

  // «15 сентября», «3 сент»
  const named = /(\d{1,2})\s+([а-я]{3,})/.exec(text);
  if (named) {
    const day = Number(named[1]);
    const word = named[2] ?? '';
    const monthIndex = MONTHS.findIndex((root) => word.startsWith(root));
    if (monthIndex >= 0 && isRealDate(year, monthIndex + 1, day)) {
      const candidate = ymd(year, monthIndex + 1, day);
      const resolved = candidate < today ? ymd(year + 1, monthIndex + 1, day) : candidate;
      return { plannedOn: resolved, matched: named[0] };
    }
  }

  // «послезавтра» — раньше «завтра», иначе внутри него нашлось бы «завтра».
  const simple: ReadonlyArray<readonly [RegExp, number]> = [
    [/послезавтра/, 2],
    [/завтра/, 1],
    [/сегодня/, 0],
  ];
  for (const [pattern, offset] of simple) {
    const hit = pattern.exec(text);
    if (hit) {
      return { plannedOn: shiftDay(today, offset), matched: hit[0] };
    }
  }

  // «через 3 дня», «через неделю», «через 2 недели», «через месяц»
  const through = /через\s+(\d+)?\s*(день|дня|дней|недел[юия]|недель|месяц[ае]?|месяцев)/.exec(text);
  if (through) {
    const count = through[1] === undefined ? 1 : Number(through[1]);
    const unit = through[2] ?? '';
    if (unit.startsWith('недел')) {
      return { plannedOn: shiftDay(today, count * 7), matched: through[0] };
    }
    if (unit.startsWith('месяц')) {
      return { plannedOn: shiftMonths(today, count), matched: through[0] };
    }
    return { plannedOn: shiftDay(today, count), matched: through[0] };
  }

  // «в пятницу», «во вторник», «в среду» — ближайший СТРОГО будущий такой день: тот, кто имеет
  // в виду сегодня, пишет «сегодня».
  // Границы слова заданы явно, а не через `\b`: в JS граница считается по латинице и цифрам,
  // и с кириллицей `\b` молча не срабатывает — дни недели не распознавались вовсе.
  const weekday = /(?:^|\s)((?:во?\s+)?(?:понедельник|вторник|сред[ауы]|четверг|пятниц[ауы]|суббот[ауы]|воскресень[еяю]))(?=$|\s|[.,;!?])/.exec(
    text,
  );
  if (weekday) {
    const word = (weekday[1] ?? '').replace(/^во?\s+/, '');
    const target = WEEKDAYS.find(([, root]) => word.startsWith(root));
    if (target) {
      const current = weekdayOf(today);
      const diff = (target[0] - current + 7) % 7;
      return { plannedOn: shiftDay(today, diff === 0 ? 7 : diff), matched: weekday[1] ?? '' };
    }
  }

  return null;
}

/**
 * Сдвигает день на N календарных месяцев, прижимая к последнему дню короткого месяца.
 *
 * «Через месяц» от 31 января — это 28 февраля, а не 3 марта: перескок через месяц удивил бы
 * сильнее, чем прижатие к его концу.
 * @param iso День `YYYY-MM-DD`.
 * @param months Сколько месяцев прибавить.
 * @returns День в том же формате.
 */
function shiftMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const baseYear = year ?? 1970;
  const baseMonth = month ?? 1;
  const baseDay = day ?? 1;
  const lastDay = new Date(baseYear, baseMonth - 1 + months + 1, 0).getDate();
  const shifted = new Date(baseYear, baseMonth - 1 + months, Math.min(baseDay, lastDay));
  return ymd(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate());
}
