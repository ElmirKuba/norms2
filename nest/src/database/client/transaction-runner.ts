import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from './database.constants';
import type { DrizzleDatabase } from './database.constants';
import type { TransactionRunnerPort } from '../../shared/transactions/transaction-runner.port';
import type { Transaction } from '../../shared/transactions/transaction.interface';

/**
 * Drizzle-реализация раннера транзакций. Оборачивает `db.transaction` и отдаёт
 * tx наружу как опаковый `Transaction` (репозитории приводят его обратно к
 * DrizzleExecutor). Единственное место, где транзакция Drizzle «видна».
 */
@Injectable()
export class DrizzleTransactionRunner implements TransactionRunnerPort {
  /**
   * @param _db Инстанс Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Выполняет работу в транзакции Drizzle.
   * @param work Функция с опаковым tx.
   * @returns Результат work; при ошибке — откат.
   */
  public async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this._db.transaction(async (tx) => work(tx as unknown as Transaction));
  }
}
