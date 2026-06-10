import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readBackendVersion } from '../../shared/utility-level/read-package-version.util';
import type { VersionInfo } from './interfaces/version-info.interface';
import type { Env } from '../../system/config/env.schema';

/**
 * Контроллер версии (`GET /api/v1/version`, ADR-0044) — публичный (футер виден до
 * входа). Отдаёт версию продукта (из конфига), версию бэка (из package.json) и
 * git-SHA билда. Тонкий слой: чтение конфига + util, домена нет.
 */
@Controller('version')
export class VersionController {
  /**
   * @param _configService Конфиг (PRODUCT_VERSION, GIT_COMMIT).
   */
  public constructor(private readonly _configService: ConfigService<Env, true>) {}

  /**
   * Версия развёрнутого билда.
   * @returns { product, backend, commit }.
   */
  @Get()
  public get(): VersionInfo {
    return {
      product: this._configService.get('PRODUCT_VERSION', { infer: true }),
      backend: readBackendVersion(),
      commit: this._configService.get('GIT_COMMIT', { infer: true }),
    };
  }
}
