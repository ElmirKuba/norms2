import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/** Конверт ошибки, отдаваемый наружу (единый формат для всего API). */
interface ErrorEnvelope {
  error: {
    /** Машинный код ошибки (для клиента/i18n). */
    code: string;
    /** Человекочитаемое сообщение. */
    message: string;
    /** Доп. детали (например, список ошибок валидации). */
    details?: unknown;
  };
}

/** Соответствие HTTP-статуса машинному коду. */
const STATUS_CODE_MAP: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

/**
 * Глобальный фильтр исключений: любую ошибку приводит к единому конверту
 * `{ error: { code, message, details? } }`. Стектрейсы наружу не уходят;
 * 5xx логируются. Доменные типизированные ошибки добавим на этапе A.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  /** Логгер фильтра (роутится в pino после useLogger). */
  private readonly _logger = new Logger(AllExceptionsFilter.name);

  /**
   * Перехватывает исключение и формирует HTTP-ответ-конверт.
   * @param exception Брошенное исключение (любого типа).
   * @param host Контекст запроса Nest.
   * @returns Ничего — пишет ответ напрямую.
   */
  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутренняя ошибка сервера';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        const bodyMessage: unknown = body['message'];
        if (Array.isArray(bodyMessage)) {
          // Сообщения валидации (class-validator/zod-pipe) — в details.
          message = 'Ошибка валидации запроса';
          details = bodyMessage;
        } else if (typeof bodyMessage === 'string') {
          message = bodyMessage;
        } else {
          message = exception.message;
        }
      }
    }

    const code: string = STATUS_CODE_MAP[status] ?? 'ERROR';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this._logger.error(
        `${code}: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const envelope: ErrorEnvelope = {
      error: details === undefined ? { code, message } : { code, message, details },
    };
    response.status(status).json(envelope);
  }
}
