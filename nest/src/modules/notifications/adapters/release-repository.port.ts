import type { ReleaseFull } from '../interfaces/release-full.interface';
import type { ReleasePure } from '../interfaces/release-pure.interface';
import type { ReleaseView } from '../interfaces/release-view.interface';

/** DI-токен порта репозитория публикаций (релизов). */
export const RELEASE_REPOSITORY = Symbol('RELEASE_REPOSITORY');

/**
 * Порт репозитория **публикаций** (БЕЗ ORM, [ADR-0065](../../../../../docs/decisions/0065-release-vs-notification-split.md)).
 *
 * Отделён от репозитория уведомлений намеренно: витрина читает публикации и про доставку не знает
 * вовсе, а `notification_reads` сюда не заглядывает — чтение снаружи структурно не может задеть
 * чей-то счётчик непрочитанного ([ADR-0064 §5](../../../../../docs/decisions/0064-telegram-release-channel.md)).
 */
export interface ReleaseRepositoryPort {
  /**
   * Публикации для витрины, новые сверху (по дате выпуска с откатом на дату записи).
   * @returns Проекции витрины.
   */
  listPublic(): Promise<ReleaseView[]>;

  /**
   * Одна публикация по публичному ключу (`release-2.9.1`).
   * @param key Ключ.
   * @returns Проекция витрины или null.
   */
  findByKey(key: string): Promise<ReleaseView | null>;

  /**
   * Создаёт публикацию, если её ключа ещё нет (идемпотентный сид).
   * @param id Идентификатор (используется только при вставке).
   * @param data Данные публикации.
   * @returns `id` существующей или созданной строки и признак «создана прямо сейчас» — по нему
   *   сидер решает, объявлять ли релиз в канал (накопленная история ждёт отдельной команды).
   */
  createIfAbsentByKey(id: string, data: ReleasePure): Promise<{ id: string; created: boolean }>;

  /**
   * Проставляет дату выпуска публикации, у которой её ещё нет (2.9.1·15).
   *
   * Нужен ради уже засеянных баз: вставка на существующую строку не действует, а без досева поле
   * осталось бы пустым ровно там, где порядок и врал. Только когда `published_at is null`: правка
   * уже проставленной даты — переписывание истории, а не сид.
   * @param key Ключ публикации.
   * @param publishedAt Дата выпуска.
   * @returns Промис завершения.
   */
  setPublishedAtIfAbsent(key: string, publishedAt: Date): Promise<void>;

  /**
   * Помечает публикацию объявленной во внешний канал.
   * @param id Идентификатор публикации.
   * @returns Промис завершения.
   */
  markBroadcasted(id: string): Promise<void>;

  /**
   * Публикации без отметки о вещании, старые → новые. Для публикации истории по явной команде.
   * @returns Строки в хронологическом порядке.
   */
  listUnbroadcasted(): Promise<ReleaseFull[]>;

  /**
   * Удаляет публикацию по ключу (2.9.3·7).
   *
   * Каскад по `notifications.release_id` уносит доставку, а оттуда — отметки прочтения
   * ([ADR-0065](../../../../../docs/decisions/0065-release-vs-notification-split.md)). Одно
   * действие вместо трёх ручных `delete` в psql, которыми это делалось 09.08.2026.
   *
   * @param key Публичный ключ публикации.
   * @returns Удалённая публикация или `null`, если такой не было.
   */
  deleteByKey(key: string): Promise<ReleaseFull | null>;
}
