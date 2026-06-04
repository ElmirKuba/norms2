import { ValidationError } from '../../../shared/errors/validation.error';

/** Алфавит генерации (без визуально похожих 0/O/1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Длина кода. */
const CODE_LENGTH = 10;
/** Допустимый формат после нормализации. */
const CODE_PATTERN = /^[A-Z0-9]{10}$/;

/**
 * VO кода приглашения: 10 символов без дефисов (формат `XXXX-XXXX-XX` — только
 * визуально на фронте). Генерируется из безопасного алфавита; на входе
 * нормализуется (убрать дефисы/пробелы, в верхний регистр) и валидируется.
 */
export class InviteCodeValue {
  /**
   * @param value Нормализованный 10-символьный код.
   */
  private constructor(public readonly value: string) {}

  /**
   * Генерирует новый случайный код.
   * @returns Новый InviteCodeValue.
   */
  public static generate(): InviteCodeValue {
    const bytes = new Uint8Array(CODE_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    let code = '';
    for (const byte of bytes) {
      code += ALPHABET.charAt(byte % ALPHABET.length);
    }
    return new InviteCodeValue(code);
  }

  /**
   * Создаёт код из сырой строки (с нормализацией).
   * @param raw Сырое значение (возможно с дефисами/в нижнем регистре).
   * @returns Валидный InviteCodeValue.
   * @throws {ValidationError} Если после нормализации формат неверен.
   */
  public static create(raw: string): InviteCodeValue {
    const normalized = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!CODE_PATTERN.test(normalized)) {
      throw new ValidationError('Код приглашения: 10 символов (буквы/цифры).');
    }
    return new InviteCodeValue(normalized);
  }
}
