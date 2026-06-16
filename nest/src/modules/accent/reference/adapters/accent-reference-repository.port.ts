import type { AccentDomainFull } from '../interfaces/accent-domain-full.interface';
import type { AccentAttributeFull } from '../interfaces/accent-attribute-full.interface';

/** DI-токен порта репозитория справочников «Акцента» (биндится в accent-reference.module). */
export const ACCENT_REFERENCE_REPOSITORY = Symbol('ACCENT_REFERENCE_REPOSITORY');

/**
 * Порт репозитория справочников раздела (сферы + RPG-атрибуты), БЕЗ ORM.
 * Реализация — `database/repositories/accent` (Drizzle). Read-only каталоги.
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
}
