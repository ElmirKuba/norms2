import { ValidationError } from '../../../shared/errors/validation.error';

/**
 * VO пароля — плейнтекст длиной 3–64 (ADR-0032; мин 3 — осознанный риск закрытой
 * площадки). Приходит по TLS, хешируется argon2id в нижнем слое. Значение —
 * чувствительное, в логи не попадает (redact, pino).
 */
export class Password {
  /**
   * @param value Провалидированный плейнтекст пароля.
   */
  private constructor(public readonly value: string) {}

  /**
   * Создаёт пароль с проверкой длины.
   * @param raw Сырой плейнтекст.
   * @returns Валидный Password.
   * @throws {ValidationError} Если длина вне 3–64.
   */
  public static create(raw: string): Password {
    if (raw.length < 3 || raw.length > 64) {
      throw new ValidationError('Пароль: 3–64 символа.');
    }
    return new Password(raw);
  }
}
