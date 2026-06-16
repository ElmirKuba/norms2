import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { accentDomains } from '../../schemas/accent-domains.schema';
import { accentAttributes } from '../../schemas/accent-attributes.schema';
import type { AccentReferenceRepositoryPort } from '../../../modules/accent/reference/adapters/accent-reference-repository.port';
import type { AccentDomainFull } from '../../../modules/accent/reference/interfaces/accent-domain-full.interface';
import type { AccentAttributeFull } from '../../../modules/accent/reference/interfaces/accent-attribute-full.interface';

/**
 * Drizzle-реализация порта справочников «Акцента» (единственное место с ORM).
 * Строки структурно совпадают с Full-интерфейсами (колонки 1:1) → прямой возврат.
 * Отдаёт только активные записи, отсортированные по `position`.
 */
@Injectable()
export class AccentReferenceRepository implements AccentReferenceRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Активные сферы по `position`.
   * @returns Каталог сфер.
   */
  public async listDomains(): Promise<AccentDomainFull[]> {
    return this._db
      .select()
      .from(accentDomains)
      .where(eq(accentDomains.isActive, true))
      .orderBy(asc(accentDomains.position));
  }

  /**
   * Активные атрибуты по `position`.
   * @returns Каталог атрибутов.
   */
  public async listAttributes(): Promise<AccentAttributeFull[]> {
    return this._db
      .select()
      .from(accentAttributes)
      .where(eq(accentAttributes.isActive, true))
      .orderBy(asc(accentAttributes.position));
  }
}
