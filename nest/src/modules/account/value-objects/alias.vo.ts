import { ValidationError } from '../../../shared/errors/validation.error';

/** Допустимые символы: Unicode-буквы/цифры + пробел + дефис. */
const ALIAS_PATTERN = /^[\p{L}\p{N} -]+$/u;

/**
 * VO отображаемого имени: 3–32 символа, Unicode-буквы/цифры/пробел/дефис;
 * нормализуется (trim + схлоп пробелов); НЕ уникален (ADR-0032).
 */
export class Alias {
  /**
   * @param value Нормализованное провалидированное значение.
   */
  private constructor(public readonly value: string) {}

  /**
   * Создаёт псевдоним: нормализует и проверяет инварианты.
   * @param raw Сырое значение.
   * @returns Валидный Alias (уже нормализованный).
   * @throws {ValidationError} Если длина вне 3–32 или есть недопустимые символы.
   */
  public static create(raw: string): Alias {
    const normalized = raw.trim().replace(/\s+/g, ' ');
    if (normalized.length < 3 || normalized.length > 32 || !ALIAS_PATTERN.test(normalized)) {
      throw new ValidationError('Псевдоним: 3–32 символа (буквы/цифры/пробел/дефис).');
    }
    return new Alias(normalized);
  }
}
