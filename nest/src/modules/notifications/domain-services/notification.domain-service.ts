import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../adapters/notification-repository.port';
import { RELEASE_REPOSITORY } from '../adapters/release-repository.port';
import { RELEASE_BROADCAST } from '../adapters/release-broadcast.port';
import type { NotificationRepositoryPort } from '../adapters/notification-repository.port';
import type { ReleaseRepositoryPort } from '../adapters/release-repository.port';
import type { ReleaseBroadcastPort } from '../adapters/release-broadcast.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { ReleaseAlreadyBroadcastedError } from '../../../shared/errors/release-already-broadcasted.error';
import type { NotificationView } from '../interfaces/notification-view.interface';
import type { ReleaseView } from '../interfaces/release-view.interface';
import type { ReleaseFull } from '../interfaces/release-full.interface';
import type { ReleasePure } from '../interfaces/release-pure.interface';

/**
 * Разбирает ключ релиз-ноты (`release-2.9.0`) в числа версии.
 * @param key Ключ ноты.
 * @returns Части версии или null, если ключ не той формы.
 */
function parseReleaseVersion(key: string): number[] | null {
  const match = /^release-(\d+(?:\.\d+)*)$/.exec(key);
  const version = match?.[1];
  if (version === undefined) {
    return null;
  }
  return version.split('.').map(Number);
}

/**
 * Сравнивает ключи релизов так, чтобы новая версия шла первой.
 *
 * **Это тайбрейк, а не основная сортировка.** Основную делает БД по `published_at` (·15). Но дату
 * выпуска мы знаем с точностью до дня — часа выпуска у нас нет, и выдумывать минуты, лишь бы
 * получить строгий порядок, значит подделывать факт. Поэтому релизы одного дня (2.2.0 и 2.3.0,
 * 2.8.0 и 2.9.0) приходят из базы в произвольном порядке, и здесь их разводит номер версии —
 * величина, которая про очерёдность выпусков знает точно.
 *
 * @param leftKey Ключ слева.
 * @param rightKey Ключ справа.
 * @returns Отрицательное — левый новее.
 */
function compareReleaseKeysDesc(leftKey: string, rightKey: string): number {
  const left = parseReleaseVersion(leftKey);
  const right = parseReleaseVersion(rightKey);
  if (left === null || right === null) {
    // Ключ неожиданной формы не должен утаскивать список в случайный порядок:
    // такие ноты уходят вниз, между собой — по алфавиту.
    if (left === null && right === null) {
      return leftKey.localeCompare(rightKey);
    }
    return left === null ? 1 : -1;
  }
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/**
 * Domain-service области notifications: список/счётчик/отметки + создание
 * персональных уведомлений (зовётся кросс-доменно, напр. из регистрации по коду).
 * Зависит только от порта репозитория.
 */
@Injectable()
export class NotificationDomainService {
  /**
   * @param _notificationRepository Порт репозитория уведомлений.
   * @param _releaseRepository Порт репозитория публикаций.
   * @param _broadcast Порт вещания релизов наружу — вещание по команде админа (2.9.3·13).
   */
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly _notificationRepository: NotificationRepositoryPort,
    @Inject(RELEASE_REPOSITORY) private readonly _releaseRepository: ReleaseRepositoryPort,
    @Inject(RELEASE_BROADCAST) private readonly _broadcast: ReleaseBroadcastPort,
  ) {}

  /**
   * Мои уведомления (broadcast + персональные), новые сверху, с флагом read.
   * @param accountId Смотрящий.
   * @returns Проекции.
   */
  public async list(accountId: string): Promise<NotificationView[]> {
    return this._notificationRepository.listForAccount(accountId);
  }

  /**
   * Релизные ноты для публичной витрины, новые сверху. Без авторизации и без
   * отметок о прочтении (ADR-0064 §5).
   * @returns Проекции витрины.
   */
  public async listReleases(): Promise<ReleaseView[]> {
    const releases = await this._releaseRepository.listPublic();
    // База уже отсортировала по дате выпуска; здесь разводим только совпавшие дни.
    return [...releases].sort((left, right) => {
      const leftDate = (left.publishedAt ?? left.createdAt).getTime();
      const rightDate = (right.publishedAt ?? right.createdAt).getTime();
      const sameDay = new Date(leftDate).toDateString() === new Date(rightDate).toDateString();
      return sameDay ? compareReleaseKeysDesc(left.key, right.key) : rightDate - leftDate;
    });
  }

  /**
   * Одна релизная нота по публичному ключу.
   * @param key Ключ (`release-2.9.0`).
   * @returns Проекция или null, если такой релизной ноты нет.
   */
  public async findReleaseByKey(key: string): Promise<ReleaseView | null> {
    return this._releaseRepository.findByKey(key);
  }

  /**
   * Все публикации для админки, новые сверху (2.9.3·13).
   * @returns Полные строки — с `broadcastedAt`, которого нет у витрины.
   */
  public async listAllReleases(): Promise<ReleaseFull[]> {
    return this._releaseRepository.listAll();
  }

  /**
   * Регистрирует публикацию и её доставку в колокольчики (2.9.3·13).
   *
   * **Две записи, а не одна** ([ADR-0065](../../../../docs/decisions/0065-release-vs-notification-split.md)):
   * публикация существует сама по себе и видна снаружи без аккаунта, доставка — это событие для
   * людей. Ровно тот же порядок, что у сида, и та же идемпотентность по ключу.
   *
   * **Вещания здесь нет намеренно.** Именно автоматика «создал → объявил» заставила гасить бота
   * при выкатке 2.9.2: момент, когда о релизе узнают, выбирает человек, а не деплой.
   *
   * @param data Содержательные поля публикации.
   * @returns Созданная строка или null, если публикация с таким ключом уже есть.
   */
  public async createRelease(data: ReleasePure): Promise<ReleaseFull | null> {
    const { created } = await this._releaseRepository.createIfAbsentByKey(generateId(), data);
    if (!created) {
      return null;
    }
    const release = await this._releaseRepository.findFullByKey(data.key);
    if (release === null) {
      // Недостижимо: строку только что создали в этой же транзакции вставки.
      return null;
    }
    await this._notificationRepository.createIfAbsentByKey(generateId(), {
      kind: 'release',
      accountId: null,
      title: data.title,
      body: null,
      releaseId: release.id,
    });
    return release;
  }

  /**
   * Объявляет публикацию во внешний канал по явной команде (2.9.3·13).
   *
   * **Повтор не проходит:** отметка `broadcastedAt` и есть защита от двойного клика — канал не
   * должен получать один и тот же пост дважды.
   *
   * @param key Публичный ключ публикации.
   * @returns Итог: строка после попытки и признак доставки; `null`, если публикации нет.
   * @throws {ReleaseAlreadyBroadcastedError} Если релиз уже объявлен.
   */
  public async broadcastRelease(
    key: string,
  ): Promise<{ release: ReleaseFull; sent: boolean } | null> {
    const release = await this._releaseRepository.findFullByKey(key);
    if (release === null) {
      return null;
    }
    if (release.broadcastedAt !== null) {
      throw new ReleaseAlreadyBroadcastedError(
        `Релиз '${key}' уже объявлен в канал ${release.broadcastedAt.toISOString()}.`,
      );
    }
    const sent = await this._broadcast.announce({
      key: release.key,
      title: release.title,
      contentFile: release.contentFile,
    });
    if (!sent) {
      // Отметку ставим только по факту доставки: иначе непрошедший пост навсегда считался бы
      // объявленным, и повторить его было бы нечем.
      return { release, sent: false };
    }
    await this._releaseRepository.markBroadcasted(release.id);
    const updated = await this._releaseRepository.findFullByKey(key);
    return { release: updated ?? release, sent: true };
  }

  /**
   * Удаляет публикацию вместе с доставкой и отметками прочтения (2.9.3·7).
   *
   * **Каскад — не побочный эффект, а смысл операции** ([ADR-0065](../../../../docs/decisions/0065-release-vs-notification-split.md)):
   * удалить публикацию, оставив уведомления, значит оставить в колокольчиках строки, ведущие в
   * никуда. Три ручных `delete` в psql, которыми это делалось 09.08.2026, схлопываются в один.
   *
   * ⚠️ **Пост в Telegram при этом остаётся** — id постов канала нигде не хранятся, удалять их
   * бот не умеет. Канал чистится руками.
   *
   * @param key Публичный ключ публикации.
   * @returns Заголовок удалённой публикации или null, если такой не было.
   */
  public async deleteRelease(key: string): Promise<{ key: string; title: string } | null> {
    const removed = await this._releaseRepository.deleteByKey(key);
    return removed === null ? null : { key: removed.key, title: removed.title };
  }

  /**
   * Число непрочитанных моих уведомлений.
   * @param accountId Смотрящий.
   * @returns Количество.
   */
  public async countUnread(accountId: string): Promise<number> {
    return this._notificationRepository.countUnread(accountId);
  }

  /**
   * Отмечает прочитанным — только если уведомление адресовано мне (broadcast или
   * персональное мне). Иначе no-op (без утечки). Идемпотентно.
   * @param accountId Смотрящий.
   * @param notificationId Уведомление.
   * @returns Промис завершения.
   */
  public async markRead(accountId: string, notificationId: string): Promise<void> {
    const notification = await this._notificationRepository.findById(notificationId);
    if (notification === null) {
      return;
    }
    if (notification.accountId !== null && notification.accountId !== accountId) {
      return;
    }
    await this._notificationRepository.insertRead(generateId(), accountId, notificationId);
  }

  /**
   * Отмечает все мои непрочитанные прочитанными.
   * @param accountId Смотрящий.
   * @returns Промис завершения.
   */
  public async markAllRead(accountId: string): Promise<void> {
    const ids = await this._notificationRepository.listUnreadIds(accountId);
    await this._notificationRepository.insertReads(
      ids.map((notificationId) => ({ id: generateId(), accountId, notificationId })),
    );
  }

  /**
   * Персональное уведомление пригласившему: по его коду присоединился участник.
   * Best-effort (зовётся после успешной регистрации; не в транзакции).
   * @param inviterId Кому (пригласивший).
   * @param joinedLogin Логин присоединившегося.
   * @returns Промис завершения.
   */
  public async notifyInviteAccepted(inviterId: string, joinedLogin: string): Promise<void> {
    await this._notificationRepository.create(generateId(), {
      kind: 'personal',
      accountId: inviterId,
      title: 'Новый участник',
      body: `По вашему коду присоединился @${joinedLogin}`,
      // Не доставка релиза — публикации за этим уведомлением нет.
      releaseId: null,
    });
  }

  /**
   * Персональное уведомление о личном событии в разделе — достижение, веха «держусь» (2.9).
   * **Спокойная строка в колокольчик вместо модалки с конфетти:** праздник, который перебивает
   * экран, это язык казино, а достижение у нас — констатация поступка.
   * Best-effort: зовётся после того, как факт уже записан, и падать за собой ничего не тянет.
   * @param accountId Кому.
   * @param title Заголовок (название достижения или вехи).
   * @param body Текст.
   * @returns Промис завершения.
   */
  public async notifyPersonalMilestone(
    accountId: string,
    title: string,
    body: string,
  ): Promise<void> {
    await this._notificationRepository.create(generateId(), {
      kind: 'personal',
      accountId,
      title,
      body,
      // Не доставка релиза — публикации за этим уведомлением нет.
      releaseId: null,
    });
  }
}
