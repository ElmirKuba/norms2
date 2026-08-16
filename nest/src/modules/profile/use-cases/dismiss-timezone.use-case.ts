import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { isValidTimezone } from '../../../shared/utility-level/timezone.util';
import { TimezoneInvalidError } from '../../../shared/errors/timezone-invalid.error';

/**
 * Use-case отказа от предложения сменить пояс (`POST /accounts/me/timezone-dismiss`, 2.10·A3).
 *
 * Помнит **одну** зону, а не список: устройство сообщило другую — прежний отказ забывается сам.
 * Так «уехал дальше» и «вернулся домой» разбираются без единой даты в логике, то есть без
 * протухания и без возни с переводом часов.
 */
@Injectable()
export class DismissTimezoneUseCase {
  /**
   * @param _accounts Domain-service аккаунтов.
   */
  public constructor(private readonly _accounts: AccountDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone Зона, про которую больше не спрашивать, или `null` — забыть отказ.
   * @returns Что запомнили.
   * @throws {TimezoneInvalidError} Если зона не существует.
   */
  public async execute(
    accountId: string,
    timezone: string | null,
  ): Promise<{ dismissedTimezone: string | null }> {
    if (timezone !== null && !isValidTimezone(timezone)) {
      throw new TimezoneInvalidError(`Часовой пояс «${timezone}» не существует.`);
    }
    await this._accounts.setDismissedTimezone(accountId, timezone);
    return { dismissedTimezone: timezone };
  }
}
