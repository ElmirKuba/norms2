import { Controller, Get } from '@nestjs/common';
import { GetHealthUseCase } from '../../use-cases/health/get-health.use-case';
import type { HealthStatus } from '../../interfaces/health/health-status.interface';

/**
 * Контроллер health-проверки. С учётом глобального префикса даёт
 * `GET /api/v1/health`. Тонкий слой: делегирует в use-case.
 */
@Controller('health')
export class HealthController {
  /**
   * @param _getHealthUseCase Use-case формирования статуса живости.
   */
  public constructor(private readonly _getHealthUseCase: GetHealthUseCase) {}

  /**
   * Возвращает статус живости сервиса.
   * @returns Текущий health-статус.
   */
  @Get()
  public check(): HealthStatus {
    return this._getHealthUseCase.execute();
  }
}
