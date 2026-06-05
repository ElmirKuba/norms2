import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { AVATAR_STORAGE } from '../../modules/profile/adapters/avatar-storage.port';
import type { AvatarStoragePort } from '../../modules/profile/adapters/avatar-storage.port';
import { generateId } from '../../shared/utility-level/generate-id.util';
import type { Env } from '../config/env.schema';

/** Подпапка аватарок внутри content/. */
const AVATARS_SUBDIR = 'avatars';

/**
 * Disk-реализация хранилища аватарок (единственное место, где про `fs` знают).
 * Пишет в `<CONTENT_DIR>/avatars/`, имя — `generateId().<ext>` на каждую загрузку
 * (новое имя — против кеша браузера; старый файл удаляет use-case после смены БД).
 * Биндится на токен AVATAR_STORAGE в profile.module.
 */
@Injectable()
export class AvatarDiskStorage implements AvatarStoragePort {
  /** Абсолютный корень content/. */
  private readonly _contentDir: string;

  /**
   * @param configService Конфиг (CONTENT_DIR).
   */
  public constructor(@Inject(ConfigService) configService: ConfigService<Env, true>) {
    this._contentDir = configService.get('CONTENT_DIR', { infer: true });
  }

  /**
   * Сохраняет файл аватарки.
   * @param data Байты.
   * @param ext Расширение.
   * @returns Относительный путь `avatars/<id>.<ext>`.
   */
  public async save(data: Buffer, ext: string): Promise<string> {
    const relativePath = posix.join(AVATARS_SUBDIR, `${generateId()}.${ext}`);
    const absolutePath = join(this._contentDir, relativePath);
    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, data);
    return relativePath;
  }

  /**
   * Удаляет файл (отсутствие — не ошибка).
   * @param relativePath Относительный путь.
   * @returns Промис завершения.
   */
  public async delete(relativePath: string): Promise<void> {
    try {
      await fs.unlink(join(this._contentDir, relativePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
