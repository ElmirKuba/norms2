import { Inject, Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { AVATAR_STORAGE } from '../adapters/avatar-storage.port';
import type { AvatarStoragePort } from '../adapters/avatar-storage.port';
import type { AccountRead } from '../../account/interfaces/account-read.interface';

/**
 * Use-case удаления аватарки. Порядок: **БД=null → удалить файл** (источник истины
 * — БД; осиротевший файл безопаснее, чем висящий путь на отсутствующий файл).
 */
@Injectable()
export class RemoveAvatarUseCase {
  /**
   * @param _avatarStorage Порт хранилища.
   * @param _accountDomainService Domain-service account.
   */
  public constructor(
    @Inject(AVATAR_STORAGE) private readonly _avatarStorage: AvatarStoragePort,
    private readonly _accountDomainService: AccountDomainService,
  ) {}

  /**
   * Удаляет аватарку.
   * @param accountId Владелец (из Guard).
   * @param currentAvatar Текущий путь или null.
   * @returns Обновлённый профиль без секрета.
   */
  public async execute(accountId: string, currentAvatar: string | null): Promise<AccountRead> {
    const updated = await this._accountDomainService.setAvatar(accountId, null);
    if (currentAvatar !== null) {
      await this._avatarStorage.delete(currentAvatar);
    }
    const { passwordHash: _passwordHash, ...read } = updated;
    return read;
  }
}
