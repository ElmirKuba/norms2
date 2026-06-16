import { Injectable } from '@nestjs/common';
import { AccentReferenceDomainService } from '../domain-services/accent-reference.domain-service';
import type { AccentRefItem } from '../interfaces/accent-ref-item.interface';

/**
 * Use-case списка RPG-атрибутов (`GET /accent/attributes`). Тонкий: зовёт domain и
 * проецирует каталог в `{ key, title }`.
 */
@Injectable()
export class ListAttributesUseCase {
  /**
   * @param _reference Domain-service справочников.
   */
  public constructor(private readonly _reference: AccentReferenceDomainService) {}

  /**
   * @returns Активные атрибуты (key + title), по `position`.
   */
  public async execute(): Promise<AccentRefItem[]> {
    const attributes = await this._reference.listAttributes();
    return attributes.map((attribute) => ({ key: attribute.key, title: attribute.title }));
  }
}
