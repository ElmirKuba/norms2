import type { DraftStep } from './request-draft.store';

/** Границы длины ответов: короче — бессмысленно, длиннее — уже не анкета. */
const LIMITS: Record<DraftStep, { min: number; max: number }> = {
  name: { min: 2, max: 40 },
  age: { min: 1, max: 3 },
  gender: { min: 1, max: 20 },
  why: { min: 10, max: 400 },
};

/** Разумные границы возраста. */
const AGE_MIN = 10;
const AGE_MAX = 120;

/** Вопросы по шагам. */
export const QUESTIONS: Record<DraftStep, string> = {
  name: 'Как к тебе обращаться? Хватит имени или ника — паспортных данных не нужно.',
  age: 'Сколько тебе лет? Просто число.',
  gender: 'Пол? Можно одним словом или «не важно».',
  why: 'И главное: зачем тебе «Нормисы»? Пары предложений достаточно.',
};

/**
 * Предупреждение перед первым вопросом.
 *
 * Тот же щит, что на «своём вопросе» восстановления ([ADR-0006](../../../../docs/decisions/0006-registration-field-rules.md)):
 * человек пишет свободный текст и по привычке кладёт туда телефон, место работы, адрес. Сказать
 * об этом надо **до** первого ответа — после уже поздно, текст отправлен.
 */
export const PRIVACY_NOTICE = [
  '<b>Заявка на вступление</b>',
  '',
  'Четыре коротких вопроса. Отвечай по одному сообщению на вопрос.',
  '',
  '⚠️ Не пиши телефон, адрес, паспортные данные и место работы — они мне не нужны и мы их не храним. Ответы живут в этой переписке и в памяти процесса, пока заявка не отправлена.',
  '',
  'Передумал — /cancel.',
].join('\n');

/** Итог проверки ответа. */
export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Проверяет ответ на шаг анкеты.
 *
 * Проверка нужна не ради чистоты данных (мы их не храним), а ради владельца: он читает заявку и
 * решает по ней. «ъ» вместо имени и «ходу» вместо возраста делают решение невозможным.
 *
 * @param step Шаг.
 * @param raw Что прислал человек.
 * @returns Результат: нормализованное значение или текст ошибки для ответа.
 */
export function validateAnswer(step: DraftStep, raw: string): ValidationResult {
  const value = raw.trim().replace(/\s+/g, ' ');
  const limit = LIMITS[step];

  if (value.length < limit.min) {
    return {
      ok: false,
      error:
        step === 'why'
          ? 'Слишком коротко — напиши хотя бы пару предложений, владельцу нужно на что-то опереться.'
          : `Слишком коротко, нужно хотя бы ${String(limit.min)} символа.`,
    };
  }
  if (value.length > limit.max) {
    return { ok: false, error: `Слишком длинно — уложись в ${String(limit.max)} символов.` };
  }
  if (step === 'age') {
    if (!/^\d+$/.test(value)) {
      return { ok: false, error: 'Возраст — числом, пожалуйста. Например: 27' };
    }
    const age = Number(value);
    if (age < AGE_MIN || age > AGE_MAX) {
      return { ok: false, error: 'Похоже на опечатку. Напиши настоящий возраст числом.' };
    }
  }
  return { ok: true, value };
}
