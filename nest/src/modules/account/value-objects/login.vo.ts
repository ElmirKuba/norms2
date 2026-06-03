import { ValidationError } from '../../../shared/errors/validation.error';

/** Допустимый формат логина. */
const LOGIN_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

/** Зарезервированные логины (сравнение по lower) — ADR-0006. */
const RESERVED_LOGINS: ReadonlySet<string> = new Set<string>([
  'admin',
  'root',
  'moderator',
  'mod',
  'support',
  'system',
  'normis',
  'normisy',
  'null',
  'me',
]);

/**
 * VO логина: 3–32 символа `[A-Za-z0-9_]`, равенство регистронезависимо, не из
 * зарезервированного списка (ADR-0006). Невалидный логин создать нельзя.
 */
export class Login {
  /**
   * @param value Провалидированное значение логина (как ввёл пользователь).
   */
  private constructor(public readonly value: string) {}

  /**
   * Создаёт логин с проверкой инвариантов.
   * @param raw Сырое значение.
   * @returns Валидный Login.
   * @throws {ValidationError} Если формат неверен или логин зарезервирован.
   */
  public static create(raw: string): Login {
    if (!LOGIN_PATTERN.test(raw)) {
      throw new ValidationError('Логин: 3–32 символа [A-Za-z0-9_].');
    }
    if (RESERVED_LOGINS.has(raw.toLowerCase())) {
      throw new ValidationError('Этот логин зарезервирован.');
    }
    return new Login(raw);
  }

  /** Нормализованное значение (lower) — для уникальности и сравнения. */
  public get normalized(): string {
    return this.value.toLowerCase();
  }

  /**
   * Регистронезависимое равенство двух логинов.
   * @param other Другой логин.
   * @returns true, если логины эквивалентны.
   */
  public equals(other: Login): boolean {
    return this.normalized === other.normalized;
  }
}
