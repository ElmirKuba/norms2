import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationDomainService } from '../../notifications/domain-services/notification.domain-service';
import { ReleaseContentService } from '../../notifications/domain-services/release-content.service';
import { AUDIT_ACTIONS, AuditDomainService } from '../../audit/domain-services/audit.domain-service';
import { ValidationError } from '../../../shared/errors/validation.error';
import type { ReleaseFull } from '../../notifications/interfaces/release-full.interface';
import type { NotificationContentFormat } from '../../notifications/interfaces/notification-pure.interface';
import type { RoleActor } from './manage-roles.use-case';

/**
 * Ключ едет в публичный URL (`/releases/<key>`), поэтому форма у него узкая: строчные буквы,
 * цифры, точка, дефис и подчёркивание. Не косметика — ключ с пробелом или слэшем ломает адрес,
 * а исправить его потом нельзя: по нему уже ушёл пост в канал.
 */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** Что нужно для создания публикации. */
export interface CreateReleaseInput {
  /** Публичный ключ (`release-2.9.3`). */
  key: string;
  /** Заголовок. */
  title: string;
  /** Путь к `.md` относительно папки контента или null у ноты-страницы. */
  contentFile: string | null;
  /** Чем является содержимое. */
  contentFormat: NotificationContentFormat;
  /** Дата выпуска или null — тогда «сейчас». */
  publishedAt: Date | null;
}

/**
 * Публикации релизов из админки: список, создание, вещание (2.9.3·13).
 *
 * **Создание и вещание разведены намеренно.** Именно автоматика «появился релиз → объявлен в
 * канал» заставила гасить бота при выкатке 2.9.2: сидер отрабатывает на каждом старте, и деплой
 * оказывался равен публичному анонсу. Момент, когда о выпуске узнают, выбирает человек.
 *
 * **Файл ноты не загружается через API.** Тексты живут в репозитории и приезжают образом; заливка
 * контента по HTTP превратила бы админку в CMS и оторвала историю выпусков от git. Панель лишь
 * регистрирует публикацию для файла, который **уже развёрнут**, — и проверяет, что он на месте:
 * зарегистрированная нота без файла открывается пустой страницей, а понять это можно только
 * глазами.
 */
@Injectable()
export class ManageReleasesUseCase {
  /**
   * @param _notifications Доменный сервис публикаций и доставки.
   * @param _content Содержимое нот на диске.
   * @param _audit Журнал действий.
   */
  public constructor(
    private readonly _notifications: NotificationDomainService,
    private readonly _content: ReleaseContentService,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Все публикации, новые сверху.
   * @returns Полные строки — с датой вещания.
   */
  public async list(): Promise<ReleaseFull[]> {
    return this._notifications.listAllReleases();
  }

  /**
   * Регистрирует публикацию и её доставку в колокольчики. В канал ничего не уходит.
   * @param input Поля публикации.
   * @param actor Кто создаёт.
   * @returns Созданная строка.
   * @throws {ValidationError} При кривом ключе или несобранной паре «формат ↔ файл» (400).
   * @throws {ConflictException} Если публикация с таким ключом уже есть (409).
   */
  public async create(input: CreateReleaseInput, actor: RoleActor): Promise<ReleaseFull> {
    const key = input.key.trim().toLowerCase();
    if (!KEY_PATTERN.test(key)) {
      throw new ValidationError(
        'Ключ может содержать только строчные латинские буквы, цифры, точку, дефис и подчёркивание.',
      );
    }
    const title = input.title.trim();
    if (title === '') {
      throw new ValidationError('Заголовок обязателен — он виден в колокольчике и в посте канала.');
    }

    // Пара «формат ↔ файл» проверяется в обе стороны: `md` без файла открывается пустой
    // страницей, `page` с файлом оставляет в `content/` мусор, который никто не читает.
    if (input.contentFormat === 'md') {
      if (input.contentFile === null || input.contentFile.trim() === '') {
        throw new ValidationError('Для формата «текст» нужен путь к .md-файлу.');
      }
      if (!this._content.ensureAvailable(input.contentFile.trim())) {
        throw new ValidationError(
          `Файл '${input.contentFile.trim()}' не найден ни в раздаваемой папке, ни в seed-content. Тексты нот приезжают вместе с образом — сначала выкатите файл, потом регистрируйте публикацию.`,
        );
      }
    } else if (input.contentFile !== null && input.contentFile.trim() !== '') {
      throw new ValidationError('У ноты-страницы файла быть не должно — её содержимое это экран фронта.');
    }

    const created = await this._notifications.createRelease({
      key,
      title,
      contentFile: input.contentFormat === 'md' ? (input.contentFile?.trim() ?? null) : null,
      contentFormat: input.contentFormat,
      publishedAt: input.publishedAt ?? new Date(),
      broadcastedAt: null,
    });
    if (created === null) {
      throw new ConflictException({ message: `Публикация '${key}' уже существует.` });
    }

    await this._audit.record({
      action: AUDIT_ACTIONS.RELEASE_CREATED,
      actorAccountId: actor.accountId,
      actorLogin: actor.login,
      targetType: 'release',
      targetId: created.key,
      targetLabel: created.title,
      details: { contentFormat: created.contentFormat, contentFile: created.contentFile },
    });
    return created;
  }

  /**
   * Объявляет релиз во внешний канал по явной команде.
   * @param key Публичный ключ.
   * @param actor Кто объявляет.
   * @returns Строка после попытки и признак доставки.
   * @throws {NotFoundException} Если публикации нет.
   */
  public async broadcast(key: string, actor: RoleActor): Promise<{ release: ReleaseFull; sent: boolean }> {
    const outcome = await this._notifications.broadcastRelease(key);
    if (outcome === null) {
      throw new NotFoundException();
    }
    // Пишем и неудачную попытку: «нажимал, но не ушло» — ровно тот случай, который потом
    // приходится восстанавливать по памяти.
    await this._audit.record({
      action: AUDIT_ACTIONS.RELEASE_BROADCASTED,
      actorAccountId: actor.accountId,
      actorLogin: actor.login,
      targetType: 'release',
      targetId: outcome.release.key,
      targetLabel: outcome.release.title,
      details: { sent: outcome.sent },
    });
    return outcome;
  }
}
