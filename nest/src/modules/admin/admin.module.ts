import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { AccountModule } from '../account/account.module';
import { NotificationCoreModule } from '../notifications/notification-core.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import { AdminReleasesController } from './controllers/admin-releases.controller';
import { AdminTelegramController } from './controllers/admin-telegram.controller';
import { ListSettingsUseCase } from './use-cases/list-settings.use-case';
import { UpdateSettingUseCase } from './use-cases/update-setting.use-case';
import { DeleteReleaseUseCase } from './use-cases/delete-release.use-case';
import { ManageRolesUseCase } from './use-cases/manage-roles.use-case';

/**
 * Техническая админка (2.9.3·7) — все ручки под `/api/v1/admin/*`.
 *
 * **Отдельный модуль, а не админские методы по фичам** (реш. ·5): один префикс — одно место, где
 * висят `AuthGuard` + `RolesGuard`, и забытая защита видна глазами. Если разложить админские
 * действия по своим областям, проверка прав размажется по условиям внутри методов, и однажды
 * условие ошибётся.
 *
 * **Кросс-домен идёт вниз:** use-cases админки зовут domain-services чужих областей
 * (`SettingsDomainService`, `NotificationDomainService`), но не их use-cases — поэтому круговой
 * DI невозможен. `AccountModule` здесь ради `ROLE_REPOSITORY`, который читает `RolesGuard`.
 *
 * **Исключение — `ReviewRequestsUseCase` из `TelegramModule` (2.9.3·11).** Разбор заявок
 * кросс-доменен по своей природе (квота в `account`, код в `invites`), поэтому domain-service-ом
 * быть не может, а копировать его в админку прямо запрещено контрактом ·5: два пути решения
 * разъедутся молча. Поэтому админка **вызывает тот же use-case**, а не свою версию. Цикла нет:
 * telegram про admin ничего не знает.
 */
@Module({
  imports: [AccessControlModule, AccountModule, NotificationCoreModule, TelegramModule],
  controllers: [
    AdminSettingsController,
    AdminReleasesController,
    AdminAccountsController,
    AdminTelegramController,
  ],
  providers: [ListSettingsUseCase, UpdateSettingUseCase, DeleteReleaseUseCase, ManageRolesUseCase],
})
export class AdminModule {}
