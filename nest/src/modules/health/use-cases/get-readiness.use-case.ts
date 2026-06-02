import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../../database/client/database.service';
import type { ReadinessStatus } from '../interfaces/readiness-status.interface';

/**
 * Use-case проверки готовности сервиса (readiness): пингует БД. Если база
 * недоступна — бросает 503 (готов = ok только при доступных зависимостях).
 */
@Injectable()
export class GetReadinessUseCase {
  /**
   * @param _databaseService Сервис БД (источник пинга).
   */
  public constructor(private readonly _databaseService: DatabaseService) {}

  /**
   * Проверяет доступность зависимостей (БД) и формирует статус готовности.
   * @returns Статус готовности при доступной БД.
   * @throws {ServiceUnavailableException} Если БД недоступна (HTTP 503).
   */
  public async execute(): Promise<ReadinessStatus> {
    try {
      await this._databaseService.ping();
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
