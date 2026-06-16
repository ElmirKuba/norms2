import { Injectable } from '@nestjs/common';
import { AccentReferenceDomainService } from '../domain-services/accent-reference.domain-service';
import type { AccentRefItem } from '../interfaces/accent-ref-item.interface';

/**
 * Use-case списка сфер (`GET /accent/domains`). Тонкий: зовёт domain и проецирует
 * каталог в `{ key, title }`.
 */
@Injectable()
export class ListDomainsUseCase {
  /**
   * @param _reference Domain-service справочников.
   */
  public constructor(private readonly _reference: AccentReferenceDomainService) {}

  /**
   * @returns Активные сферы (key + title), по `position`.
   */
  public async execute(): Promise<AccentRefItem[]> {
    const domains = await this._reference.listDomains();
    return domains.map((domain) => ({ key: domain.key, title: domain.title }));
  }
}
