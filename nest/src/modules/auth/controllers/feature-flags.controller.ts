import { Controller, Get } from '@nestjs/common';
import { GetFeatureFlagsUseCase } from '../use-cases/get-feature-flags.use-case';
import type { FeatureFlags } from '../interfaces/feature-flags.interface';

/**
 * Контроллер флагов площадки. С глобальным префиксом: `GET /api/v1/feature-flags`
 * (вне /auth — грузится фронтом на старте). Тонкий слой.
 */
@Controller('feature-flags')
export class FeatureFlagsController {
  /**
   * @param _getFeatureFlagsUseCase Use-case флагов.
   */
  public constructor(private readonly _getFeatureFlagsUseCase: GetFeatureFlagsUseCase) {}

  /**
   * Возвращает флаги площадки.
   * @returns Флаги.
   */
  @Get()
  public flags(): FeatureFlags {
    return this._getFeatureFlagsUseCase.execute();
  }
}
