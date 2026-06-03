import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Хеш-сервис на argon2id — общий для пароля и ответов восстановления (ADR-0009).
 * Наружу отдаёт только строки/boolean: доменные слои про argon2 не знают (можно
 * заменить алгоритм, не трогая домен).
 */
@Injectable()
export class HashService {
  /**
   * Хеширует плейнтекст (argon2id).
   * @param plain Плейнтекст (пароль / нормализованный ответ).
   * @returns Строка-хеш (с встроенными солью и параметрами).
   */
  public async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /**
   * Проверяет плейнтекст против хеша. Повреждённый хеш → false (не бросает).
   * @param hash Ранее сохранённый хеш.
   * @param plain Проверяемый плейнтекст.
   * @returns true, если совпало.
   */
  public async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
