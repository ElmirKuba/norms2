import type { Transaction } from './transaction.interface';

/** DI-токен раннера транзакций. */
export const TRANSACTION_RUNNER = Symbol('TRANSACTION_RUNNER');

/**
 * Порт раннера транзакций: выполняет `work` в одной транзакции, отдавая опаковый
 * `tx`. Всё, что внутри work через этот tx — атомарно (всё или ничего). Реализация
 * — в `database/client` (Drizzle).
 */
export interface TransactionRunnerPort {
  /**
   * Выполняет работу в транзакции.
   * @param work Функция, получающая дескриптор транзакции.
   * @returns Результат work; при ошибке — откат.
   */
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}
