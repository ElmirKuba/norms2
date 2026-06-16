import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { ListDomainsUseCase } from '../use-cases/list-domains.use-case';
import { ListAttributesUseCase } from '../use-cases/list-attributes.use-case';
import type { AccentRefItem } from '../interfaces/accent-ref-item.interface';

/**
 * Контроллер справочников «Акцента» (`/api/v1/accent/domains|attributes`) — под Guard
 * (members-only). Read-only каталоги для селекторов целей/привычек. Тонкий слой:
 * контроллер → use-case.
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class AccentReferenceController {
  /**
   * @param _listDomains Список сфер.
   * @param _listAttributes Список атрибутов.
   */
  public constructor(
    private readonly _listDomains: ListDomainsUseCase,
    private readonly _listAttributes: ListAttributesUseCase,
  ) {}

  /**
   * Активные сферы жизни.
   * @returns Каталог сфер (key + title).
   */
  @Get('domains')
  public getDomains(): Promise<AccentRefItem[]> {
    return this._listDomains.execute();
  }

  /**
   * Активные RPG-атрибуты.
   * @returns Каталог атрибутов (key + title).
   */
  @Get('attributes')
  public getAttributes(): Promise<AccentRefItem[]> {
    return this._listAttributes.execute();
  }
}
