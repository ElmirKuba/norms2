import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_REFERENCE_REPOSITORY } from '../adapters/accent-reference-repository.port';
import type { AccentReferenceRepositoryPort } from '../adapters/accent-reference-repository.port';
import type { AccentDomainFull } from '../interfaces/accent-domain-full.interface';
import type { AccentAttributeFull } from '../interfaces/accent-attribute-full.interface';

/**
 * Domain-service справочников раздела «Акцент» (сферы + атрибуты). Тонкий — логики
 * нет, read-only каталоги; зависит только от порта. Экспортится из
 * `AccentReferenceModule` — другие области (цели/привычки, фронт-селекторы) зовут вниз.
 */
@Injectable()
export class AccentReferenceDomainService {
  /**
   * @param _repository Порт репозитория справочников.
   */
  public constructor(
    @Inject(ACCENT_REFERENCE_REPOSITORY) private readonly _repository: AccentReferenceRepositoryPort,
  ) {}

  /**
   * Активные сферы жизни.
   * @returns Каталог сфер.
   */
  public listDomains(): Promise<AccentDomainFull[]> {
    return this._repository.listDomains();
  }

  /**
   * Активные RPG-атрибуты.
   * @returns Каталог атрибутов.
   */
  public listAttributes(): Promise<AccentAttributeFull[]> {
    return this._repository.listAttributes();
  }
}
