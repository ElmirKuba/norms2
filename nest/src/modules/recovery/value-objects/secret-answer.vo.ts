import { ValidationError } from '../../../shared/errors/validation.error';

/** Границы длины нормализованного ответа. */
const MIN_LENGTH = 1;
const MAX_LENGTH = 200;

/**
 * VO ответа на секретный вопрос. Нормализуется для СТАБИЛЬНОГО хеша (чтобы
 * «Москва», «  москва » и «москва» совпадали при сверке): trim + нижний регистр +
 * схлоп внутренних пробелов. Хешируется argon2id на доменном слое; в БД — только хеш.
 */
export class SecretAnswer {
  /**
   * @param value Нормализованное значение (идёт в хеш).
   */
  private constructor(public readonly value: string) {}

  /**
   * Создаёт ответ: нормализует и проверяет длину.
   * @param raw Сырой ответ.
   * @returns Валидный SecretAnswer (нормализованный).
   * @throws {ValidationError} Если после нормализации пусто или длиннее лимита.
   */
  public static create(raw: string): SecretAnswer {
    const normalized = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new ValidationError(`Ответ: ${MIN_LENGTH}–${MAX_LENGTH} символов.`);
    }
    return new SecretAnswer(normalized);
  }
}
