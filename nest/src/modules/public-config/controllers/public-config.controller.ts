import { Controller, Get } from '@nestjs/common';
import { GetPublicConfigUseCase } from '../use-cases/get-public-config.use-case';
import type { PublicConfigView } from '../interfaces/public-config-view.interface';

/**
 * Публичная конфигурация приложения (`GET /api/v1/public-config`).
 *
 * **В этом файле нет и не должно быть ни одного `AuthGuard`** — его зовут страницы логина и
 * регистрации, где человек ещё не вошёл. Граница читается по файлу целиком, а не по декораторам
 * над отдельными методами.
 */
@Controller('public-config')
export class PublicConfigController {
  /**
   * @param _getPublicConfig Use-case сборки конфигурации.
   */
  public constructor(private readonly _getPublicConfig: GetPublicConfigUseCase) {}

  /**
   * Отдаёт всё, что нужно фронту до входа.
   * @returns Флаги и публичные строки.
   */
  @Get()
  public view(): PublicConfigView {
    return this._getPublicConfig.execute();
  }
}
