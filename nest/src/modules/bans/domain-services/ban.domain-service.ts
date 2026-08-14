import { Inject, Injectable } from '@nestjs/common';
import { BAN_REPOSITORY } from '../adapters/ban-repository.port';
import type { BanRepositoryPort } from '../adapters/ban-repository.port';
import { BanNotFoundError } from '../../../shared/errors/ban-not-found.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { BanFull } from '../interfaces/ban-full.interface';
import type { BanListItem } from '../interfaces/ban-list-item.interface';
import type { ActiveBanDetail } from '../interfaces/active-ban-detail.interface';

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
   * Активный бан по идентификатору — чтобы вызывающий мог проверить право снятия.
   * @param banId Идентификатор записи.
   * @returns Запись.
   * @throws {BanNotFoundError} Если нет активной записи.
   */
  public async getActive(banId: string): Promise<BanFull> {
    const found = await this._banRepository.findActiveById(banId);
    if (found === null) {
      throw new BanNotFoundError('Бан не найден.');
    }
    return found;
  }

  /**
   * Снимает бан **без проверки права** — её делает вызывающий.
   *
   * Рядом до 14.08.2026 жил `unban(banId, requesterId)` поверх `deactivateOwn`, то есть
   * «снять может только тот, кто банил». С 2.9.3·21 правило другое — право идёт вверх по ветке,
   * — и метод остался мёртвым: его не звал никто. Удалён не за неопрятность, а потому что
   * **живой код со старым правилом опаснее отсутствующего**: первый же вызывающий тихо откатил
   * бы решение, и никакой тест этого не заметил бы.
   *
   * Право проверяет вызывающий
   * ([ADR-0003, дополнение](../../../../docs/decisions/0003-ban-semantics.md)): снимать вправе
   * банивший, любой его предок по дереву или админ. Право требует дерева, а дерево — чужая
   * область, поэтому проверка живёт этажом выше, как и у самого бана.
   * @param banId Идентификатор записи.
   * @returns Промис завершения.
   * @throws {BanNotFoundError} Если запись уже снята.
   */
  public async lift(banId: string): Promise<void> {
    const lifted = await this._banRepository.deactivateById(banId);
    if (!lifted) {
      throw new BanNotFoundError('Бан не найден.');
    }
  }

  /**
   * Снимает **все** активные баны на человеке — одобренная просьба о разбане (2.9.3·22).
   *
   * Все, а не выбранные: заявка про доступ, а не про отношения с конкретным банившим, и «сняли
   * один из трёх» для человека выглядит как «ничего не изменилось».
   * @param targetId Забаненный.
   * @returns Сколько снято.
   */
  public async liftAllFor(targetId: string): Promise<number> {
    return this._banRepository.deactivateAllByTarget(targetId);
  }

  /**
   * Активные баны на цель с именем банившего (для экрана «вы забанены», ADR-0012).
   * @param targetId Цель.
   * @returns Активные баны с login/alias банившего.
   */
  public async listActiveAgainst(targetId: string): Promise<ActiveBanDetail[]> {
    return this._banRepository.listActiveByTarget(targetId);
  }

  /**
   * Мои баны (вкл. историю).
   * @param bannerId Банивший.
   * @returns Записи.
   */
  public async listMine(bannerId: string): Promise<BanListItem[]> {
    return this._banRepository.listByBanner(bannerId);
  }

  /**
   * Активные баны на множество целей (overview-полезность, F4): {targetId, bannerId}.
   * @param targetIds Идентификаторы целей.
   * @returns Пары цель→банивший активных банов.
   */
  public async listActiveBansForTargets(
    targetIds: string[],
  ): Promise<Pick<BanFull, 'targetId' | 'bannerId'>[]> {
    return this._banRepository.listActiveBansForTargets(targetIds);
  }
}
