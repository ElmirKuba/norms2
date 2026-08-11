import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../adapters/notification-repository.port';
import { RELEASE_REPOSITORY } from '../adapters/release-repository.port';
import { RELEASE_BROADCAST } from '../adapters/release-broadcast.port';
import type { ReleaseBroadcastPort } from '../adapters/release-broadcast.port';
import type { NotificationRepositoryPort } from '../adapters/notification-repository.port';
import type { ReleaseRepositoryPort } from '../adapters/release-repository.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { RELEASE_NOTES, validateReleaseNote } from './release-notes.seed';
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
   * @param _notificationRepository Порт репозитория доставки.
   * @param _releaseRepository Порт репозитория публикаций (ADR-0065).
   * @param _broadcast Порт вещания релизов наружу (2.9.1).
   * @param _configService Конфиг (CONTENT_DIR).
   */
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly _notificationRepository: NotificationRepositoryPort,
    @Inject(RELEASE_REPOSITORY) private readonly _releaseRepository: ReleaseRepositoryPort,
    @Inject(RELEASE_BROADCAST) private readonly _broadcast: ReleaseBroadcastPort,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /** Прогоняет сид релиз-нот после полной инициализации приложения. */
  public async onApplicationBootstrap(): Promise<void> {
    const contentDir = resolve(this._configService.get('CONTENT_DIR', { infer: true }));
    const seedDir = resolve(process.cwd(), SEED_DIR);

    for (const note of RELEASE_NOTES) {
      try {
        // Поломку данных не сеем вовсе ('md' без файла роняет копирование, 'page' с файлом
        // оставляет мусор в content/). Нарушение соглашения о формате — только говорим вслух:
        // номер версии выбирает человек, машина следит лишь за осознанностью выбора.
        const check = validateReleaseNote(note);
        if (check.warning !== null) {
          this._logger.warn(check.warning);
        }
        if (check.error !== null) {
          this._logger.error(`Сид релиз-ноты пропущен — ${check.error}`);
          continue;
        }
        const format = note.contentFormat ?? 'md';
        // У страницы файла нет: контент это компонент фронта, бэк хранит только формат и ключ.
        if (note.contentFile !== null) {
          this._ensureFile(seedDir, contentDir, note.contentFile);
        }
        // Сначала ПУБЛИКАЦИЯ (ADR-0065): она первична и существует независимо от того, кому и
        // когда её доставили. Идентификатор нужен дальше, чтобы связать с ней доставку.
        const release = await this._releaseRepository.createIfAbsentByKey(generateId(), {
          key: note.key,
          title: note.title,
          contentFile: note.contentFile,
          contentFormat: format,
          publishedAt: note.publishedAt,
          // Новая публикация ещё не объявлена наружу — этим займётся вещатель ниже.
          broadcastedAt: null,
        });

        // Затем ДОСТАВКА всем (broadcast). После contract-миграции 2.9.2·0 в ней остаются
        // только поля самой доставки: содержимое релиза живёт в публикации и дублировать его
        // больше некуда. Идемпотентность держится на «одна рассылка на публикацию».
        await this._notificationRepository.createIfAbsentByKey(generateId(), {
          kind: 'release',
          accountId: null,
          title: note.title,
          body: null,
          releaseId: release.id,
        });

        // Объявляем ТОЛЬКО что созданное. Накопленная история (десять старых нот) ждёт явной
        // команды владельца: иначе первый же запуск с подключённым ботом высыпал бы в канал
        // все релизы разом (2.9.1·3).
        if (release.created) {
          await this._announce(release.id, note.title, note.key, note.contentFile);
        } else {
          // Публикация уже была: вставка её не тронула, а дату выпуска проставить надо — иначе
          // на всех существующих базах поле осталось бы пустым (2.9.1·15).
          await this._releaseRepository.setPublishedAtIfAbsent(note.key, note.publishedAt);
        }
      } catch (error) {
        this._logger.warn(`Сид релиз-ноты '${note.key}' пропущен: ${String(error)}`);
      }
    }
  }

  /**
   * Объявляет свежесозданную ноту во внешний канал и ставит отметку. Best-effort: нота уже в
   * колокольчике, несостоявшийся пост её не отменяет.
   * @param id Идентификатор публикации.
   * @param title Заголовок.
   * @param key Ключ ноты.
   * @param contentFile Путь к `.md` или null у ноты-страницы.
   * @returns Промис завершения.
   */
  private async _announce(
    id: string,
    title: string,
    key: string,
    contentFile: string | null,
  ): Promise<void> {
    try {
      const delivered = await this._broadcast.announce({ key, title, contentFile });
      if (delivered) {
        await this._releaseRepository.markBroadcasted(id);
      }
    } catch (error) {
      this._logger.warn(`Релиз '${key}' не объявлен наружу: ${String(error)}`);
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
