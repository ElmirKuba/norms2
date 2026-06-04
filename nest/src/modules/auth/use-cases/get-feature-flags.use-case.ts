import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FeatureFlags } from '../interfaces/feature-flags.interface';
import type { Env } from '../../../system/config/env.schema';

/**
 * Use-case флагов площадки (GET /feature-flags). Читает конфиг.
 */
@Injectable()
export class GetFeatureFlagsUseCase {
  /**
   * @param _configService Конфиг.
   */
  public constructor(private readonly _configService: ConfigService<Env, true>) {}

  /**
   * Возвращает текущие флаги.
   * @returns Флаги площадки.
   */
  public execute(): FeatureFlags {
    return { freeRegistration: this._configService.get('FREE_REGISTRATION', { infer: true }) };
  }
}
