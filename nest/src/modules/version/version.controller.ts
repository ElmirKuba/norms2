import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readProductVersion } from '../../shared/utility-level/read-product-version.util';
import { readGitCommit } from '../../shared/utility-level/read-git-commit.util';
import type { VersionInfo } from './interfaces/version-info.interface';
import type { Env } from '../../system/config/env.schema';

/**
 * Контроллер версии (`GET /api/v1/version`, ADR-0044) — публичный (футер виден до
 * входа). Отдаёт версию продукта (файл `VERSION` в корне — единый source of truth)
 * и git-SHA билда (диагностика). Версии фронта/бэка зафиксированы на 1.0.0 и не
 * показываются. Тонкий слой: util + конфиг, домена нет.
 */
@Controller('version')
export class VersionController {
  /**
   * @param _configService Конфиг (GIT_COMMIT).
   */
  public constructor(private readonly _configService: ConfigService<Env, true>) {}

  /**
   * Версия развёрнутого билда. `commit`: задан `GIT_COMMIT` (прод, фикс на сборке) →
   * берём его; иначе живое чтение `.git` HEAD (dev — отражает текущий checkout).
   * @returns { product, commit }.
   */
  @Get()
  public get(): VersionInfo {
    const envCommit = this._configService.get('GIT_COMMIT', { infer: true });
    return {
      product: readProductVersion(),
      commit: envCommit !== '' ? envCommit : readGitCommit(),
    };
  }
}
