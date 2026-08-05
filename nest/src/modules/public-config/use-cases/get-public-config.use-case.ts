import { Injectable } from '@nestjs/common';
import { GetFeatureFlagsUseCase } from '../../auth/use-cases/get-feature-flags.use-case';
import { GetTelegramPublicUseCase } from '../../telegram/use-cases/get-telegram-public.use-case';
import type { PublicConfigView } from '../interfaces/public-config-view.interface';

/**
 * Сборка публичной конфигурации для неаутентифицированной части приложения.
 *
 * **Это единственное место, где агрегация уместна.** Обычно кросс-доменные вызовы означают, что
 * область лезет в чужие дела; здесь наоборот — модуль существует ровно затем, чтобы собрать
 * ответ из областей и не заставлять их знать друг о друге. Каждая по-прежнему отвечает только
 * за свои строки.
 */
@Injectable()
export class GetPublicConfigUseCase {
  /**
   * @param _flags Use-case флагов площадки.
   * @param _telegram Use-case публичных строк Telegram-области.
   */
  public constructor(
    private readonly _flags: GetFeatureFlagsUseCase,
    private readonly _telegram: GetTelegramPublicUseCase,
  ) {}

  /**
   * Собирает публичную конфигурацию.
   * @returns Флаги и публичные строки.
   */
  public execute(): PublicConfigView {
    return { features: this._flags.execute(), telegram: this._telegram.execute() };
  }
}
