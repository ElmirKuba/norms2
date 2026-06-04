import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DB_HEALTH } from '../adapters/db-health.port';
import type { DbHealthPort } from '../adapters/db-health.port';
import type { ReadinessStatus } from '../interfaces/readiness-status.interface';

/**
 * Use-case проверки готовности сервиса (readiness): пингует БД через ПОРТ
 * `DbHealthPort` (не зная про конкретный DatabaseService/ORM). Если база
 * недоступна — 503.
 */
@Injectable()
export class GetReadinessUseCase {
  /**
   * @param _dbHealth Порт проверки доступности БД (DI-токен DB_HEALTH).
   */
  public constructor(@Inject(DB_HEALTH) private readonly _dbHealth: DbHealthPort) {}

  /**
   * Проверяет доступность зависимостей (БД) и формирует статус готовности.
   * @returns Статус готовности при доступной БД.
   * @throws {ServiceUnavailableException} Если БД недоступна (HTTP 503).
   */
  public async execute(): Promise<ReadinessStatus> {
    try {
      await this._dbHealth.ping();
    } catch {
      throw new ServiceUnavailableException('База данных недоступна');
    }
    return {
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
