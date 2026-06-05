import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../domain-services/ban.domain-service';

/**
 * Use-case снятия бана: деактивирует ТОЛЬКО свою запись (ADR-0003 — «той же
 * кнопкой обратно»).
 */
@Injectable()
export class UnbanUserUseCase {
  /**
   * @param _banDomainService Domain-service bans.
   */
  public constructor(private readonly _banDomainService: BanDomainService) {}

  /**
   * Снимает свой бан.
   * @param banId Идентификатор записи.
   * @param requesterId Запросивший (из Guard).
   * @returns Промис завершения.
   * @throws {BanNotFoundError} Если запись не найдена/не своя/уже снята.
   */
  public async execute(banId: string, requesterId: string): Promise<void> {
    await this._banDomainService.unban(banId, requesterId);
  }
}
