import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../domain-services/ban.domain-service';
import type { BanView } from '../interfaces/ban-view.interface';

/**
 * Use-case «мои баны»: записи, где banner = текущий пользователь (вкл. историю),
 * спроецированные в BanView (без bannerId/updatedAt).
 */
@Injectable()
export class ListMyBansUseCase {
  /**
   * @param _banDomainService Domain-service bans.
   */
  public constructor(private readonly _banDomainService: BanDomainService) {}

  /**
   * Возвращает мои баны.
   * @param bannerId Банивший (из Guard).
   * @returns Проекции банов.
   */
  public async execute(bannerId: string): Promise<BanView[]> {
    const bans = await this._banDomainService.listMine(bannerId);
    return bans.map((ban) => ({
      id: ban.id,
      targetId: ban.targetId,
      reason: ban.reason,
      active: ban.active,
      createdAt: ban.createdAt,
    }));
  }
}
