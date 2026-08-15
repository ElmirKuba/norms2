import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { isValidTimezone } from '../../../shared/utility-level/timezone.util';
import { TimezoneInvalidError } from '../../../shared/errors/timezone-invalid.error';

/**
 * Use-case смены часового пояса (`POST /accounts/me/timezone`, 2.10·A2).
 *
 * **Здесь зона проверяется строго**, в отличие от регистрации: там мусор молча заменялся на `UTC`,
 * потому что ронять регистрацию из-за пояса нельзя, а тут человек меняет его осознанно — и должен
 * узнать, что зона не существует, а не обнаружить `UTC` вместо выбранного.
 */
@Injectable()
export class UpdateTimezoneUseCase {
  /**
   * @param _accounts Domain-service аккаунтов.
   */
  public constructor(private readonly _accounts: AccountDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone Новая зона (IANA).
   * @returns Установленная зона.
   * @throws {TimezoneInvalidError} Если зона не существует.
   */
  public async execute(accountId: string, timezone: string): Promise<{ timezone: string }> {
    if (!isValidTimezone(timezone)) {
      throw new TimezoneInvalidError(`Часовой пояс «${timezone}» не существует.`);
    }
    await this._accounts.updateTimezone(accountId, timezone);
    return { timezone };
  }
}
