import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Generic-пайп валидации входа по zod-схеме (closed-shape). На невалидном входе
 * бросает BadRequest с перечнем ошибок по полям → глобальный filter кладёт их в
 * `details` конверта. Без class-validator и без nestjs-zod (минимум зависимостей).
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  /**
   * @param _schema zod-схема ожидаемого тела/параметра.
   */
  public constructor(private readonly _schema: ZodType<T>) {}

  /**
   * Валидирует и возвращает типизированное значение.
   * @param value Сырое значение запроса.
   * @returns Провалидированное значение типа T.
   * @throws {BadRequestException} Если значение не проходит схему.
   */
  public transform(value: unknown): T {
    const result = this._schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue): string => `${issue.path.join('.')}: ${issue.message}`),
      );
    }
    return result.data;
  }
}
