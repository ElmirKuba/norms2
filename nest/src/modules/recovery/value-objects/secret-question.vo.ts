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
    // TODO: Claude Code: 2026-06-05: чёрный список тем вопросов (ADR-0006) —
    // согласовать конкретный список запрещённых тем с Elmir, затем добавить проверку.
    return new SecretQuestion(normalized);
  }
}
