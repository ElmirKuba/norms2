/**
 * Утилита для `clock`-привычек (FEAT-H2, ADR-0058): значения лесенки хранятся как «минуты от
 * вечернего якоря» (midnight-safe), а пользователю показываются как время суток «HH:MM».
 *
 * Якорь по умолчанию — 18:00 (1080 мин от полуночи): времена вечера/ночи/следующего дня
 * ложатся на монотонную шкалу 0..1439, где «раньше по циклу» = меньше. Так «отбой раньше» —
 * это меньшее число, и полярность `lower` двигает цель вниз корректно через полночь.
 */
export const CLOCK_ANCHOR_MINUTES = 18 * 60; // 1080 = 18:00

/** «HH:MM» → минуты от якоря (0..1439) или null, если строка некорректна. */
export function timeToAnchorMinutes(hhmm: string, anchor: number = CLOCK_ANCHOR_MINUTES): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (m === null) {
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) {
    return null;
  }
  return (h * 60 + min - anchor + 1440) % 1440;
}

/** Минуты от якоря → «HH:MM». */
export function anchorMinutesToTime(mfa: number, anchor: number = CLOCK_ANCHOR_MINUTES): string {
  const tMin = (((Math.round(mfa) + anchor) % 1440) + 1440) % 1440;
  const h = Math.floor(tMin / 60);
  const min = tMin % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
