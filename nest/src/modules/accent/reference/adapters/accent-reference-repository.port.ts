import type { AccentDomainFull } from '../interfaces/accent-domain-full.interface';
import type { AccentAttributeFull } from '../interfaces/accent-attribute-full.interface';

/** DI-токен порта репозитория справочников «Акцента» (биндится в accent-reference.module). */
export const ACCENT_REFERENCE_REPOSITORY = Symbol('ACCENT_REFERENCE_REPOSITORY');

/** Запись справочника на запись (сид): ключ + название + порядок. */
export interface AccentRefSeedRow {
  key: string;
  title: string;
  position: number;
}

/**
 * Порт репозитория справочников раздела (сферы + RPG-атрибуты), БЕЗ ORM.
 * Реализация — `database/repositories/accent` (Drizzle). Чтение каталогов + сид.
 */
export interface AccentReferenceRepositoryPort {
  /**
   * Активные сферы жизни, по `position`.
   * @returns Каталог сфер.
   */
  listDomains(): Promise<AccentDomainFull[]>;

  /**
   * Активные RPG-атрибуты, по `position`.
   * @returns Каталог атрибутов.
   */
  listAttributes(): Promise<AccentAttributeFull[]>;

  /**
   * Идемпотентно создаёт сферы (сид): ON CONFLICT по `key` — не дублирует и не
   * перетирает существующие. Пустой список — no-op.
   * @param items Записи справочника.
   * @returns Промис завершения.
   */
  ensureDomains(items: readonly AccentRefSeedRow[]): Promise<void>;

  /**
   * Идемпотентно создаёт атрибуты (сид): ON CONFLICT по `key`. Пустой список — no-op.
   * @param items Записи справочника.
   * @returns Промис завершения.
   */
  ensureAttributes(items: readonly AccentRefSeedRow[]): Promise<void>;
}
