import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../adapters/notification-repository.port';
import { RELEASE_REPOSITORY } from '../adapters/release-repository.port';
import type { NotificationRepositoryPort } from '../adapters/notification-repository.port';
import type { ReleaseRepositoryPort } from '../adapters/release-repository.port';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { NotificationView } from '../interfaces/notification-view.interface';
import type { ReleaseView } from '../interfaces/release-view.interface';

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
   */
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly _notificationRepository: NotificationRepositoryPort,
    @Inject(RELEASE_REPOSITORY) private readonly _releaseRepository: ReleaseRepositoryPort,
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
