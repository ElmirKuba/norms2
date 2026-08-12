import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import type { AccountFull } from '../../account/interfaces/account-full.interface';
import type { AccountRead } from '../../account/interfaces/account-read.interface';

/**
 * Свой профиль (2.9.3·8).
 *
 * Появился, когда в проекцию добавились роли: раньше контроллер сам снимал `passwordHash` и
 * этого хватало, а теперь нужен ещё запрос ролей — то есть работа, а не проекция. Контроллер
 * зовёт use-case, use-case — domain-service; ходить в domain-service из контроллера нельзя
 * (CLAUDE.md, правила зависимостей).
 */
@Injectable()
export class GetMyProfileUseCase {
  /**
   * @param _accountDomainService Domain-service аккаунтов.
   */
  public constructor(private readonly _accountDomainService: AccountDomainService) {}

  /**
   * Отдаёт профиль без секрета, с кодами ролей.
   * @param account Аккаунт, загруженный Guard'ом.
   * @returns Проекция профиля.
   */
  public async execute(account: AccountFull): Promise<AccountRead> {
    return this._accountDomainService.toRead(account);
  }
}
