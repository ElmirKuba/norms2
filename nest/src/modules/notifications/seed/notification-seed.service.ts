import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../adapters/notification-repository.port';
import type { NotificationRepositoryPort } from '../adapters/notification-repository.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { RELEASE_NOTES } from './release-notes.seed';
import type { Env } from '../../../system/config/env.schema';

/** Папка с авторскими seed-файлами в образе/репо (рядом с рантаймом, cwd-relative). */
const SEED_DIR = 'seed-content';

/**
 * Сид релиз-нот (F7): на старте приложения гарантирует для каждой записи
 * `RELEASE_NOTES` (а) наличие `.md` в раздаваемом `CONTENT_DIR` (копирует из
 * `seed-content/`, если файла нет) и (б) broadcast-строку `kind='release'`
 * (идемпотентно по `key`). Так релиз-нота появляется на свежем деплое сама, без
 * ручной вставки; повторный старт дублей не плодит. Best-effort: сбой сида не валит
 * запуск приложения.
 */
@Injectable()
export class NotificationSeedService implements OnApplicationBootstrap {
  private readonly _logger = new Logger(NotificationSeedService.name);

  /**
   * @param _notificationRepository Порт репозитория уведомлений.
   * @param _configService Конфиг (CONTENT_DIR).
   */
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly _notificationRepository: NotificationRepositoryPort,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /** Прогоняет сид релиз-нот после полной инициализации приложения. */
  public async onApplicationBootstrap(): Promise<void> {
    const contentDir = resolve(this._configService.get('CONTENT_DIR', { infer: true }));
    const seedDir = resolve(process.cwd(), SEED_DIR);

    for (const note of RELEASE_NOTES) {
      try {
        this._ensureFile(seedDir, contentDir, note.contentFile);
        await this._notificationRepository.createIfAbsentByKey(generateId(), {
          kind: 'release',
          accountId: null,
          title: note.title,
          body: null,
          contentFile: note.contentFile,
          key: note.key,
        });
      } catch (error) {
        this._logger.warn(`Сид релиз-ноты '${note.key}' пропущен: ${String(error)}`);
      }
    }
  }

  /** Копирует `.md` из seed-content в content/, если в content/ его ещё нет. */
  private _ensureFile(seedDir: string, contentDir: string, contentFile: string): void {
    const dest = join(contentDir, contentFile);
    if (existsSync(dest)) {
      return;
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(seedDir, contentFile), dest);
    this._logger.log(`Релиз-нота скопирована в content/: ${contentFile}`);
  }
}
