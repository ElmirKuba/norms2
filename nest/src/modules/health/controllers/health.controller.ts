import { Controller, Get } from '@nestjs/common';
import { GetHealthUseCase } from '../use-cases/get-health.use-case';
import { GetReadinessUseCase } from '../use-cases/get-readiness.use-case';
import type { HealthStatus } from '../interfaces/health-status.interface';
import type { ReadinessStatus } from '../interfaces/readiness-status.interface';

/**
 * Контроллер health-проверки. С учётом глобального префикса даёт
 * `GET /api/v1/health` (liveness) и `GET /api/v1/health/ready` (readiness).
 * Тонкий слой: делегирует в use-cases.
 */
@Controller('health')
export class HealthController {
  /**
   * @param _getHealthUseCase Use-case статуса живости (liveness).
   * @param _getReadinessUseCase Use-case статуса готовности (readiness, пинг БД).
   */
  public constructor(
    private readonly _getHealthUseCase: GetHealthUseCase,
    private readonly _getReadinessUseCase: GetReadinessUseCase,
  ) {}

  /**
   * Возвращает статус живости сервиса (процесс жив, без проверки зависимостей).
   * @returns Текущий health-статус.
   */
  @Get()
  public check(): HealthStatus {
    return this._getHealthUseCase.execute();
  }

  /**
   * Возвращает статус готовности (пинг БД); 503, если зависимости недоступны.
   * @returns Статус готовности.
   */
  @Get('ready')
  public ready(): Promise<ReadinessStatus> {
    return this._getReadinessUseCase.execute();
  }
}
