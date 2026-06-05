import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { AVATAR_STORAGE } from '../adapters/avatar-storage.port';
import type { AvatarStoragePort } from '../adapters/avatar-storage.port';
import { AvatarInvalidError } from '../../../shared/errors/avatar-invalid.error';
import { detectImageExt } from '../../../shared/utility-level/image-type.util';
import type { AccountRead } from '../../account/interfaces/account-read.interface';
import type { Env } from '../../../system/config/env.schema';

/** Загруженный файл (минимально нужное; без зависимости от @types/multer). */
export interface AvatarUpload {
  /** Байты файла. */
  buffer: Buffer;
  /** Размер в байтах. */
  size: number;
}

/**
 * Use-case загрузки аватарки. Валидирует размер (`AVATAR_MAX_BYTES`) и тип по
 * magic-bytes, сохраняет файл (storage↓) и пишет путь (account↓). Порядок:
 * **новый файл → БД → удалить старый** ([[avatar-storage-conventions]]); при сбое
 * записи БД — удаляет осиротевший новый файл (компенсация).
 */
@Injectable()
export class UploadAvatarUseCase {
  /**
   * @param _avatarStorage Порт хранилища аватарок.
   * @param _accountDomainService Domain-service account.
   * @param _configService Конфиг (AVATAR_MAX_BYTES).
   */
  public constructor(
    @Inject(AVATAR_STORAGE) private readonly _avatarStorage: AvatarStoragePort,
    private readonly _accountDomainService: AccountDomainService,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Загружает аватарку.
   * @param accountId Владелец (из Guard).
   * @param currentAvatar Текущий путь аватарки (для удаления старого) или null.
   * @param file Загруженный файл.
   * @returns Обновлённый профиль без секрета.
   * @throws {AvatarInvalidError} Если размер превышен или тип не распознан.
   */
  public async execute(
    accountId: string,
    currentAvatar: string | null,
    file: AvatarUpload,
  ): Promise<AccountRead> {
    const maxBytes = this._configService.get('AVATAR_MAX_BYTES', { infer: true });
    if (file.size > maxBytes) {
      throw new AvatarInvalidError(`Аватарка больше лимита (${String(maxBytes)} байт).`);
    }
    const ext = detectImageExt(file.buffer);
    if (ext === null) {
      throw new AvatarInvalidError('Поддерживаются только JPEG, PNG, WEBP.');
    }

    const newPath = await this._avatarStorage.save(file.buffer, ext);
    let updated;
    try {
      updated = await this._accountDomainService.setAvatar(accountId, newPath);
    } catch (error) {
      // БД не записалась — убираем осиротевший новый файл.
      await this._avatarStorage.delete(newPath);
      throw error;
    }
    if (currentAvatar !== null && currentAvatar !== newPath) {
      await this._avatarStorage.delete(currentAvatar);
    }

    const { passwordHash: _passwordHash, ...read } = updated;
    return read;
  }
}
