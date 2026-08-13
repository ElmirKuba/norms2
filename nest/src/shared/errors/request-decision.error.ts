import { DomainError } from './domain.error';

/** Почему решение по заявке не прошло. Коды машинные: бот и админка переводят их каждый по-своему. */
export type RequestDecisionFailure =
  | 'NOT_FOUND'
  | 'ALREADY_CLOSED'
  | 'QUOTA_EXHAUSTED'
  | 'NO_ACCOUNT'
  | 'WRONG_TYPE'
  | 'CREATE_FAILED';

/**
 * HTTP-статус на каждый код.
 *
 * `ALREADY_CLOSED`, `QUOTA_EXHAUSTED` и `NO_ACCOUNT` — это **409, а не 400**: запрос корректен,
 * не позволяет состояние мира. Разница видна на экране: 400 значит «исправь и повтори», 409 —
 * «повторять бессмысленно, обнови список».
 */
const HTTP_STATUS: Readonly<Record<RequestDecisionFailure, number>> = {
  NOT_FOUND: 404,
  ALREADY_CLOSED: 409,
  QUOTA_EXHAUSTED: 409,
  NO_ACCOUNT: 409,
  WRONG_TYPE: 400,
  CREATE_FAILED: 500,
};

/**
 * Отказ решения по Telegram-заявке (2.9.3·11).
 *
 * **Одна ошибка с кодом вместо шести классов** — отступление от «класс на код», принятое
 * осознанно: все шесть исходов принадлежат одному сценарию и всегда обрабатываются вместе, а
 * бот переводит их одним словарём. Шесть отдельных файлов дали бы шесть импортов ради одного
 * `switch`.
 *
 * Наследуется от `DomainError` не для красоты: глобальный фильтр умеет доставать `code` и
 * `httpStatus` **только** оттуда. Брошенный `ConflictException({error:{code}})` выглядит
 * правильно в коде, но наружу уходит обезличенным `CONFLICT` — фильтр собирает конверт сам.
 */
export class RequestDecisionError extends DomainError {
  /** Машинный код причины. */
  public readonly code: RequestDecisionFailure;
  /** HTTP-статус, соответствующий коду. */
  public readonly httpStatus: number;

  /**
   * @param code Машинный код причины.
   * @param message Человекочитаемое сообщение.
   */
  public constructor(code: RequestDecisionFailure, message: string) {
    super(message);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
