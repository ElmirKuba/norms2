import type { LastReleaseState, ProductCounters } from '../interfaces/release-state-view.interface';

/** DI-токен порта состояния продукта. */
export const ADMIN_STATE_REPOSITORY = Symbol('ADMIN_STATE_REPOSITORY');

/**
 * Порт диагностических чтений админки (2.9.3·12).
 *
 * **Отдельный порт, а не поход в чужие репозитории.** Счётчики пересекают области (аккаунты,
 * публикации, уведомления), но домена в них нет: это отчёт, а не бизнес-правило. Тянуть ради
 * него `AccountDomainService` и соседей значило бы завести зависимость админки на всё сразу —
 * при том что ни одно доменное правило здесь не применяется.
 *
 * **Только чтение.** В порте нет ни одной изменяющей операции намеренно: экран состояния
 * отвечает на вопрос «что сейчас», а рычаги живут на своих экранах.
 */
export interface AdminStateRepositoryPort {
  /**
   * Счётчики продукта.
   * @returns Числа по трём таблицам.
   */
  counters(): Promise<ProductCounters>;

  /**
   * Сколько миграций реально применено к этой базе.
   * @returns Количество строк в служебной таблице drizzle.
   */
  appliedMigrations(): Promise<number>;

  /**
   * Последняя публикация по дате выпуска.
   * @returns Публикация или null, если их нет вовсе.
   */
  lastRelease(): Promise<LastReleaseState | null>;
}
