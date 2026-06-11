import { ValidationError } from '../../../shared/errors/validation.error';

/** Границы длины нормализованного вопроса. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 200;

/**
 * VO текста секретного вопроса (из безопасного списка или свой, ADR-0008).
 * Нормализуется (trim + схлоп пробелов) и валидируется по длине. Чёрный список
 * тем (ADR-0006) — провайдится позже (список — продуктовое решение, см. TODO).
 */
export class SecretQuestion {
  /**
   * @param value Нормализованный текст вопроса.
   */
  private constructor(public readonly value: string) {}

  /**
   * Создаёт вопрос: нормализует и проверяет инварианты.
   * @param raw Сырой текст.
   * @returns Валидный SecretQuestion.
   * @throws {ValidationError} Если длина вне диапазона.
   */
  public static create(raw: string): SecretQuestion {
    const normalized = raw.trim().replace(/\s+/g, ' ');
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new ValidationError(`Вопрос: ${MIN_LENGTH}–${MAX_LENGTH} символов.`);
    }
    // Чёрного списка тем на бэке нет (реш. Elmir 2026-06-11): на free-text он
    // хрупок и обходится перефразом, а ответ хешируется (argon2). Вместо запрета —
    // мягкая UI-подсказка в форме (не использовать паспорт/ФИО/публично известное).
    return new SecretQuestion(normalized);
  }
}
