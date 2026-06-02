import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '../../interfaces/health/health-status.interface';

/**
 * Use-case проверки живости сервиса (liveness). Не ходит в БД и домен —
 * только подтверждает, что процесс поднят и отвечает. Проверку доступности
 * БД (readiness) добавим отдельным шагом.
 */
@Injectable()
export class GetHealthUseCase {
  /**
   * Формирует текущий статус живости сервиса.
   * @returns Статус: ok, аптайм процесса и метка времени.
   */
  public execute(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
