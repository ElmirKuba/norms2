import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { ListSettingsUseCase } from '../use-cases/list-settings.use-case';
import { UpdateSettingUseCase } from '../use-cases/update-setting.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { SettingDescription } from '../../settings/interfaces/setting-description.interface';

/** Тело запроса на изменение настройки. */
interface UpdateSettingBody {
  /** Новое значение строкой (для булевых — `'true'` или `'false'`). */
  value: string;
}

/**
 * Рантайм-настройки из админки (`/api/v1/admin/settings`, 2.9.3·7).
 *
 * **Guard-ы в порядке `AuthGuard` → `RolesGuard`** — второй берёт роли у аккаунта, которого в
 * запрос кладёт первый. Перестановка молча превратила бы проверку прав в пропуск: аккаунта в
 * запросе ещё нет, и `RolesGuard` отдал бы 404 всем подряд.
 *
 * **Это первая живая ручка админки.** Ею же доказывается то, ради чего настройки переезжали в
 * базу (·4): переключение действует на работающем приложении, без перезапуска.
 */
@Controller('admin/settings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminSettingsController {
  /**
   * @param _listSettingsUseCase Список настроек.
   * @param _updateSettingUseCase Изменение настройки.
   */
  public constructor(
    private readonly _listSettingsUseCase: ListSettingsUseCase,
    private readonly _updateSettingUseCase: UpdateSettingUseCase,
  ) {}

  /**
   * Список редактируемых настроек с происхождением значения.
   * @returns Описания настроек.
   */
  @Get()
  public async list(): Promise<SettingDescription[]> {
    return this._listSettingsUseCase.execute();
  }

  /**
   * Меняет значение настройки.
   * @param key Ключ настройки.
   * @param body Новое значение.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённое описание.
   */
  @Put(':key')
  public async update(
    @Param('key') key: string,
    @Body() body: UpdateSettingBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<SettingDescription> {
    return this._updateSettingUseCase.execute(key, body.value, {
      accountId: request.account.id,
      login: request.account.login,
    });
  }
}
