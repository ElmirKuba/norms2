import type { BanFull } from '../interfaces/ban-full.interface';
import type { BanCreate } from '../interfaces/ban-create.interface';
import type { BanListItem } from '../interfaces/ban-list-item.interface';

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
   * Снимает СВОЙ активный бан (active=false). Чужой/несуществующий/уже снятый — no-op.
   * @param banId Идентификатор записи.
   * @param bannerId Идентификатор владельца (должен совпасть).
   * @returns true, если запись деактивирована.
   */
  deactivateOwn(banId: string, bannerId: string): Promise<boolean>;

  /**
   * Есть ли активный бан на цель (быстрый login-чек по индексу).
   * @param targetId Идентификатор цели.
   * @returns true, если эффективно забанен.
   */
  existsActiveByTarget(targetId: string): Promise<boolean>;

  /**
   * Активные баны на цель (для сообщения «кто/за что» при логине, ADR-0012).
   * @param targetId Идентификатор цели.
   * @returns Активные записи.
   */
  listActiveByTarget(targetId: string): Promise<BanFull[]>;

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
}
