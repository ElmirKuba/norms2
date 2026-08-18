import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../adapters/notification-repository.port';
import { RELEASE_REPOSITORY } from '../adapters/release-repository.port';
import { RELEASE_BROADCAST } from '../adapters/release-broadcast.port';
import type { ReleaseBroadcastPort } from '../adapters/release-broadcast.port';
import type { NotificationRepositoryPort } from '../adapters/notification-repository.port';
import type { ReleaseRepositoryPort } from '../adapters/release-repository.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { RELEASE_NOTES, validateReleaseNote } from './release-notes.seed';
import { ReleaseContentService } from '../domain-services/release-content.service';

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
   * @param _content Содержимое нот на диске — общее с админкой (2.9.3·13).
   */
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly _notificationRepository: NotificationRepositoryPort,
    @Inject(RELEASE_REPOSITORY) private readonly _releaseRepository: ReleaseRepositoryPort,
    @Inject(RELEASE_BROADCAST) private readonly _broadcast: ReleaseBroadcastPort,
    private readonly _content: ReleaseContentService,
  ) {}

  /** Прогоняет сид релиз-нот после полной инициализации приложения. */
  public async onApplicationBootstrap(): Promise<void> {
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
        if (note.contentFile !== null && !this._content.ensureAvailable(note.contentFile)) {
          this._logger.error(`Сид релиз-ноты пропущен — файла '${note.contentFile}' нет нигде.`);
          continue;
        }
        // Текст анонса (18.08.2026) — отдельный файл у нот-страниц. Его отсутствие ноту не
        // отменяет: в колокольчике она нужна, просто пост в канал уйдёт без тезисов.
        const postFile =
          note.postFile !== undefined && this._content.ensureAvailable(note.postFile)
            ? note.postFile
            : null;
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
          await this._announce(release.id, note.title, note.key, postFile ?? note.contentFile);
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
   * @param contentFile Путь к `.md`, из которого собирается пост: тело ноты либо отдельный
   *   текст анонса у ноты-страницы; `null` — тогда в посте останутся заголовок и ссылка.
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
}
