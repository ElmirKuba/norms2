import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../domain-services/ban.domain-service';
import type { BanListItem } from '../interfaces/ban-list-item.interface';

/**
 * Use-case «мои баны»: записи, где banner = текущий пользователь (вкл. историю),
 * с login/alias цели (BanListItem — проекция из join accounts в репозитории).
 */
@Injectable()
export class ListMyBansUseCase {
  /**
   * @param _banDomainService Domain-service bans.
   */
  public constructor(private readonly _banDomainService: BanDomainService) {}

  /**
   * Возвращает мои баны с именем цели.
   * @param bannerId Банивший (из Guard).
   * @returns Проекции банов.
   */
  public async execute(bannerId: string): Promise<BanListItem[]> {
    return this._banDomainService.listMine(bannerId);
  }
}
