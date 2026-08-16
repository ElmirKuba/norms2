import { localYmd } from './today-in-timezone.util';
import { isValidTimezone } from './timezone.util';

/**
 * Граница суток в часовых поясах (2.10·A5).
 *
 * **Почему проверка машинная.** Ошибка границы суток проявляется раз в день и по случайности:
 * человек должен открыть продукт в промежутке между полуночью по своему поясу и полуночью по
 * UTC — то есть ровно в те часы, когда обычно спит. Именно так баг и прожил всю фазу 2: его
 * заметили только 14.08.2026, когда Elmir открыл продукт в 02:00.
 *
 * Даты в тестах фиксированы, а не берутся от `new Date()`: тест, зависящий от момента запуска,
 * зелёный днём и красный ночью — худший вид проверки.
 */
describe('граница суток в часовых поясах (2.10·A5)', () => {
  it('UTC+5: вечер по UTC — уже следующий день по-местному', () => {
    // 21:05 UTC 15 августа = 02:05 16 августа в Екатеринбурге.
    const moment = new Date('2026-08-15T21:05:00Z');
    expect(localYmd(moment, 'UTC')).toBe('2026-08-15');
    expect(localYmd(moment, 'Asia/Yekaterinburg')).toBe('2026-08-16');
  });

  it('UTC−5: ночь по UTC — ещё вчера по-местному', () => {
    // 02:30 UTC 16 августа = 21:30 15 августа в Нью-Йорке (летом UTC−4).
    const moment = new Date('2026-08-16T02:30:00Z');
    expect(localYmd(moment, 'UTC')).toBe('2026-08-16');
    expect(localYmd(moment, 'America/New_York')).toBe('2026-08-15');
  });

  it('ровно полночь по местному времени — уже новый день', () => {
    // 19:00 UTC = 00:00 следующего дня в Екатеринбурге.
    expect(localYmd(new Date('2026-08-15T19:00:00Z'), 'Asia/Yekaterinburg')).toBe('2026-08-16');
  });

  it('за минуту до полуночи по местному — ещё старый день', () => {
    expect(localYmd(new Date('2026-08-15T18:59:00Z'), 'Asia/Yekaterinburg')).toBe('2026-08-15');
  });

  it('23:59 по UTC остаётся тем же днём в UTC', () => {
    expect(localYmd(new Date('2026-08-15T23:59:00Z'), 'UTC')).toBe('2026-08-15');
  });

  it('смена пояса меняет толкование одного и того же момента', () => {
    // Это и есть суть решения (ADR-0070): момент один, а день — разный.
    const moment = new Date('2026-08-15T20:30:00Z');
    expect(localYmd(moment, 'Europe/Moscow')).toBe('2026-08-15');
    expect(localYmd(moment, 'Asia/Yekaterinburg')).toBe('2026-08-16');
    expect(localYmd(moment, 'Asia/Vladivostok')).toBe('2026-08-16');
  });

  it('невалидная зона не роняет расчёт, а откатывается на UTC', () => {
    const moment = new Date('2026-08-15T21:05:00Z');
    expect(localYmd(moment, 'Планета/Марс')).toBe(localYmd(moment, 'UTC'));
  });

  it('переход на летнее время учитывается: в Лондоне летом UTC+1', () => {
    // 23:30 UTC 15 июля = 00:30 16 июля в Лондоне (BST).
    expect(localYmd(new Date('2026-07-15T23:30:00Z'), 'Europe/London')).toBe('2026-07-16');
    // Зимой того же часа сдвига нет — день совпадает с UTC.
    expect(localYmd(new Date('2026-01-15T23:30:00Z'), 'Europe/London')).toBe('2026-01-15');
  });
});

describe('проверка существования зоны (2.10·A1)', () => {
  it('принимает настоящие зоны', () => {
    for (const zone of ['UTC', 'Asia/Yekaterinburg', 'Europe/Moscow', 'America/New_York']) {
      expect(isValidTimezone(zone)).toBe(true);
    }
  });

  it('отвергает выдуманные и пустые', () => {
    for (const zone of ['Планета/Марс', 'Not/AZone', '', '   ']) {
      expect(isValidTimezone(zone)).toBe(false);
    }
  });

  it('отвергает смещение вместо зоны', () => {
    // «UTC+5» — не IANA-зона: у неё нет правил перехода на летнее время, и хранить её значит
    // потерять их навсегда.
    expect(isValidTimezone('UTC+5')).toBe(false);
  });
});
