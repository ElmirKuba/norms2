import type { Transaction } from '../../../shared/transactions/transaction.interface';
import type { InviteCodeFull } from '../interfaces/invite-code-full.interface';
import type { InviteCodeCreate } from '../interfaces/invite-code-create.interface';
import type { InvitationFull } from '../interfaces/invitation-full.interface';
import type { InvitationCreate } from '../interfaces/invitation-create.interface';
import type { InviterRead } from '../interfaces/inviter-read.interface';
import type { InviteeRead } from '../interfaces/invitee-read.interface';
import type { InviteeNode } from '../interfaces/invitee-node.interface';
import type { InviteCodeRead } from '../interfaces/invite-code-read.interface';

/** DI-токен порта репозитория инвайтов. */
export const INVITE_REPOSITORY = Symbol('INVITE_REPOSITORY');

/**
 * Порт репозитория инвайтов (коды + рёбра приглашений), БЕЗ ORM. Пишущие методы
 * принимают опаковый `tx` — чтобы участвовать в общей транзакции (создание/
 * погашение инвайта трогает несколько таблиц). Реализация — Drizzle.
 */
export interface InviteRepositoryPort {
  /**
   * Создаёт pending-код.
   * @param id Идентификатор.
   * @param data Данные кода.
   * @param tx Опц. транзакция.
   * @returns Созданный код.
   */
  createCode(id: string, data: InviteCodeCreate, tx?: Transaction): Promise<InviteCodeFull>;

  /**
   * Находит активный (не истёкший) код по значению.
   * @param code Значение кода.
   * @returns Код или null (нет/истёк).
   */
  findActiveCodeByValue(code: string): Promise<InviteCodeFull | null>;

  /**
   * Список СВОИХ активных невыданных кодов (для отзыва/обзора).
   * @param inviterId Идентификатор создателя.
   * @returns Проекции кодов.
   */
  listCodesByInviter(inviterId: string): Promise<InviteCodeRead[]>;

  /**
   * Находит код по id (для проверки владения при отзыве).
   * @param id Идентификатор кода.
   * @returns Код или null.
   */
  findCodeById(id: string): Promise<InviteCodeFull | null>;

  /**
   * Удаляет код по id.
   * @param id Идентификатор.
   * @param tx Опц. транзакция.
   * @returns true, если строка была удалена.
   */
  deleteCode(id: string, tx?: Transaction): Promise<boolean>;

  /**
   * Создаёт ребро приглашения.
   * @param id Идентификатор.
   * @param data Данные ребра.
   * @param tx Опц. транзакция.
   * @returns Созданное ребро.
   */
  insertInvitation(id: string, data: InvitationCreate, tx?: Transaction): Promise<InvitationFull>;

  /**
   * Список приглашённых данным аккаунтом (с login/alias из accounts).
   * @param inviterId Идентификатор пригласившего.
   * @returns Проекции приглашённых.
   */
  listInviteesByInviter(inviterId: string): Promise<InviteeRead[]>;

  /**
   * Прямые дети узла дерева (ленивое раскрытие) + флаг `bannedByMe` смотрящего.
   * @param nodeId Узел, чьих детей берём.
   * @param viewerId Смотрящий (для флага bannedByMe).
   * @returns Прямые приглашённые узла.
   */
  listInviteesOf(nodeId: string, viewerId: string): Promise<InviteeNode[]>;

  /**
   * Обратное ребро: «кто пригласил данный аккаунт». Join с accounts за
   * login/alias пригласившего.
   * @param accountId Идентификатор приглашённого.
   * @returns Проекция пригласившего или null (корень дерева: free/seed).
   */
  findInvitationByAccount(accountId: string): Promise<InviterRead | null>;
}
