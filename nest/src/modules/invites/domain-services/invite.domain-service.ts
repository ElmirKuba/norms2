import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INVITE_REPOSITORY } from '../adapters/invite-repository.port';
import type { InviteRepositoryPort } from '../adapters/invite-repository.port';
import { InviteCodeValue } from '../value-objects/invite-code-value.vo';
import { InviteInvalidError } from '../../../shared/errors/invite-invalid.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { InviteCodeFull } from '../interfaces/invite-code-full.interface';
import type { InvitationFull } from '../interfaces/invitation-full.interface';
import type { InviterRead } from '../interfaces/inviter-read.interface';
import type { InviteeRead } from '../interfaces/invitee-read.interface';
import type { InviteeNode } from '../interfaces/invitee-node.interface';
import type { InviteCodeRead } from '../interfaces/invite-code-read.interface';
import type { Transaction } from '../../../shared/transactions/transaction.interface';
import type { Env } from '../../../system/config/env.schema';

/** Миллисекунд в сутках. */
const DAY_MS = 86_400_000;

/**
 * Domain-service области invites: бизнес-логика кодов/рёбер. Счётчик квоты НЕ
 * трогает — это кросс-домен, оркестрирует use-case (account↓ + invites↓).
 * Зависит только от порта репозитория и конфига (TTL).
 */
@Injectable()
export class InviteDomainService {
  /**
   * @param _inviteRepository Порт репозитория инвайтов.
   * @param _configService Конфиг (INVITE_TTL_DAYS).
   */
  public constructor(
    @Inject(INVITE_REPOSITORY) private readonly _inviteRepository: InviteRepositoryPort,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Создаёт pending-код (генерит значение и срок). Квоту списывает use-case.
   * @param inviterId Идентификатор создателя.
   * @param reason Причина приглашения.
   * @param tx Опц. транзакция (атомарность со списанием квоты, create-invite).
   * @returns Созданный код.
   */
  public async createCode(
    inviterId: string,
    reason: string,
    tx?: Transaction,
  ): Promise<InviteCodeFull> {
    const ttlDays = this._configService.get('INVITE_TTL_DAYS', { infer: true });
    return this._inviteRepository.createCode(
      generateId(),
      {
        code: InviteCodeValue.generate().value,
        inviterId,
        reason,
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      },
      tx,
    );
  }

  /**
   * Отзывает СВОЙ pending-код. Квоту возвращает use-case при успехе.
   * @param codeId Идентификатор кода.
   * @param requesterId Идентификатор запросившего (должен быть создателем).
   * @param tx Опц. транзакция (атомарность с возвратом квоты, revoke-invite).
   * @throws {InviteInvalidError} Если код не найден или не принадлежит запросившему.
   */
  public async revokeCode(codeId: string, requesterId: string, tx?: Transaction): Promise<void> {
    const code = await this._inviteRepository.findCodeById(codeId);
    if (code?.inviterId !== requesterId) {
      throw new InviteInvalidError('Код не найден.');
    }
    const deleted = await this._inviteRepository.deleteCode(codeId, tx);
    if (!deleted) {
      throw new InviteInvalidError('Код не найден.');
    }
  }

  /**
   * Погашает код в рамках транзакции: удаляет код (гард одноразовости) и создаёт
   * ребро приглашения. Счётчик не меняется. Вызывается из регистрации (с tx).
   * @param rawCode Сырой код от пользователя.
   * @param accountId Идентификатор приглашённого (создаётся в той же транзакции).
   * @param tx Транзакция (общая с созданием аккаунта).
   * @returns Созданное ребро приглашения.
   * @throws {InviteInvalidError} Если код недействителен/истёк/уже использован.
   */
  public async consumeCode(rawCode: string, accountId: string, tx: Transaction): Promise<InvitationFull> {
    const code = await this._inviteRepository.findActiveCodeByValue(InviteCodeValue.create(rawCode).value);
    if (code === null) {
      throw new InviteInvalidError('Недействительный или истёкший код приглашения.');
    }
    // delete как гард одноразовости: если 0 строк — код уже погашен параллельно.
    const deleted = await this._inviteRepository.deleteCode(code.id, tx);
    if (!deleted) {
      throw new InviteInvalidError('Код приглашения уже использован.');
    }
    return this._inviteRepository.insertInvitation(
      generateId(),
      { accountId, inviterId: code.inviterId, reason: code.reason, invitedAt: new Date() },
      tx,
    );
  }

  /**
   * Проверяет, валиден ли код (для предпроверки на фронте). Не бросает.
   * @param rawCode Сырой код.
   * @returns true, если код существует и не истёк.
   */
  public async checkCode(rawCode: string): Promise<boolean> {
    let normalized: string;
    try {
      normalized = InviteCodeValue.create(rawCode).value;
    } catch {
      return false;
    }
    return (await this._inviteRepository.findActiveCodeByValue(normalized)) !== null;
  }

  /**
   * Список приглашённых данным аккаунтом (с login/alias из accounts).
   * @param inviterId Идентификатор пригласившего.
   * @returns Проекции приглашённых.
   */
  public async listInvitees(inviterId: string): Promise<InviteeRead[]> {
    return this._inviteRepository.listInviteesByInviter(inviterId);
  }

  /**
   * Прямые дети узла дерева (ленивое раскрытие, F3.Д) + флаг `bannedByMe`. Право
   * на просмотр проверяет use-case (кросс-домен с invite-tree).
   * @param nodeId Узел, чьих детей берём.
   * @param viewerId Смотрящий (для флага bannedByMe).
   * @returns Прямые приглашённые узла.
   */
  public async listInviteesOf(nodeId: string, viewerId: string): Promise<InviteeNode[]> {
    return this._inviteRepository.listInviteesOf(nodeId, viewerId);
  }

  /**
   * Список СВОИХ активных невыданных кодов (для отзыва/обзора).
   * @param inviterId Идентификатор создателя.
   * @returns Проекции кодов.
   */
  public async listMyCodes(inviterId: string): Promise<InviteCodeRead[]> {
    return this._inviteRepository.listCodesByInviter(inviterId);
  }

  /**
   * «Кто пригласил данный аккаунт» (обратное ребро). null у корней (free/seed).
   * Эндпоинт-обёртка — F3.2·БЭК.2.
   * @param accountId Идентификатор приглашённого.
   * @returns Проекция пригласившего или null.
   */
  public async getInviterOf(accountId: string): Promise<InviterRead | null> {
    return this._inviteRepository.findInvitationByAccount(accountId);
  }
}
