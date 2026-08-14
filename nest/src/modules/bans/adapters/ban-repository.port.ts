import type { BanFull } from '../interfaces/ban-full.interface';
import type { BanCreate } from '../interfaces/ban-create.interface';
import type { BanListItem } from '../interfaces/ban-list-item.interface';
import type { ActiveBanDetail } from '../interfaces/active-ban-detail.interface';

/** DI-токен порта репозитория банов (биндится в bans.module). */
export const BAN_REPOSITORY = Symbol('BAN_REPOSITORY');

/**
 * Порт репозитория банов, БЕЗ ORM. «Забанен» — производное (EXISTS active,
 * ADR-0012); уникальность активной записи на пару (banner, target) — partial-unique.
 */
export interface BanRepositoryPort {
  /**
   * Создаёт бан идемпотентно: при существующей активной записи на пару
   * (banner, target) обновляет причину (а не падает на partial-unique).
   * @param id Идентификатор (генерит домен).
   * @param data Данные создания (banner/target/reason).
   * @returns Актуальная активная запись.
   */
  createBan(id: string, data: BanCreate): Promise<BanFull>;

  /**
   * Активные баны на цель с именем банившего (join accounts) — для экрана
   * «вы забанены»: кто/за что (ADR-0012).
   * @param targetId Идентификатор цели.
   * @returns Активные баны с login/alias банившего.
   */
  listActiveByTarget(targetId: string): Promise<ActiveBanDetail[]>;

  /**
   * Баны, выданные данным аккаунтом («мои баны»), с login/alias цели (join accounts).
   * @param bannerId Идентификатор банившего.
   * @returns Проекции (вкл. историю снятых), новые сверху.
   */
  listByBanner(bannerId: string): Promise<BanListItem[]>;

  /**
   * Активные баны на множество целей (для overview-полезности, F4): по каждой
   * активной записи — кто цель и кто банивший. Пустой список целей → пустой результат.
   * @param targetIds Идентификаторы целей.
   * @returns Пары {targetId, bannerId} активных банов (может быть >1 на цель).
   */
  listActiveBansForTargets(targetIds: string[]): Promise<Pick<BanFull, 'targetId' | 'bannerId'>[]>;
  /**
   * Активный бан по идентификатору (для проверки права снятия по ветке).
   * @param banId Идентификатор записи.
   * @returns Строка или null.
   */
  findActiveById(banId: string): Promise<BanFull | null>;

  /**
   * Деактивирует запись без проверки владения — право проверяет domain-service.
   * @param banId Идентификатор записи.
   * @returns true, если деактивирована.
   */
  deactivateById(banId: string): Promise<boolean>;

  /**
   * Снимает все активные баны на человеке.
   * @param targetId Забаненный.
   * @returns Сколько снято.
   */
  deactivateAllByTarget(targetId: string): Promise<number>;

}
