import { Inject, Injectable } from '@nestjs/common';
import { BAN_REPOSITORY } from '../adapters/ban-repository.port';
import type { BanRepositoryPort } from '../adapters/ban-repository.port';
import { BanNotFoundError } from '../../../shared/errors/ban-not-found.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { BanFull } from '../interfaces/ban-full.interface';

/**
 * Domain-service области bans: логика записей бана. Право банить (isAncestor) —
 * НЕ здесь: это кросс-домен, проверяет use-case (зовёт InviteTree вниз, ADR-0030).
 * Зависит только от порта репозитория.
 */
@Injectable()
export class BanDomainService {
  /**
   * @param _banRepository Порт репозитория банов.
   */
  public constructor(@Inject(BAN_REPOSITORY) private readonly _banRepository: BanRepositoryPort) {}

  /**
   * Ставит бан идемпотентно (повтор активного — обновит причину). Право — на use-case.
   * @param bannerId Банивший.
   * @param targetId Цель.
   * @param reason Причина.
   * @returns Актуальная запись.
   */
  public async ban(bannerId: string, targetId: string, reason: string): Promise<BanFull> {
    return this._banRepository.createBan(generateId(), { bannerId, targetId, reason });
  }

  /**
   * Снимает СВОЙ бан.
   * @param banId Идентификатор записи.
   * @param requesterId Запросивший (владелец).
   * @throws {BanNotFoundError} Если запись не найдена/не своя/уже снята.
   */
  public async unban(banId: string, requesterId: string): Promise<void> {
    const deactivated = await this._banRepository.deactivateOwn(banId, requesterId);
    if (!deactivated) {
      throw new BanNotFoundError('Бан не найден.');
    }
  }

  /**
   * Активные баны на цель (для login-сообщения, ADR-0012).
   * @param targetId Цель.
   * @returns Активные записи.
   */
  public async listActiveAgainst(targetId: string): Promise<BanFull[]> {
    return this._banRepository.listActiveByTarget(targetId);
  }

  /**
   * Мои баны (вкл. историю).
   * @param bannerId Банивший.
   * @returns Записи.
   */
  public async listMine(bannerId: string): Promise<BanFull[]> {
    return this._banRepository.listByBanner(bannerId);
  }
}
