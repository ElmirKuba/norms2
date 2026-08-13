import type {
  TelegramRequestStatus,
  TelegramRequestType,
} from './telegram-request-pure.interface';

/**
 * Строка заявки для разбора (2.9.3·11) — то, что видит решающий.
 *
 * ⚠️ **`chatId` уходит наружу только здесь и только админу.** Это идентификатор человека в чужом
 * сервисе; в остальных проекциях его нет. Текста заявки тут нет вовсе — он не хранится
 * (ADR-0064 §10), его показывает бот пересылкой сохранённого сообщения.
 */
export interface TelegramRequestReviewView {
  /** Идентификатор заявки. */
  id: string;
  /** Чат заявителя. */
  chatId: string;
  /** Что просят. */
  type: TelegramRequestType;
  /** Где заявка в жизненном цикле. */
  status: TelegramRequestStatus;
  /** Аккаунт заявителя (только у `more_invites`) или null. */
  accountId: string | null;
  /** Логин этого аккаунта или null — чтобы на экране не светился голый идентификатор. */
  accountLogin: string | null;
  /** Выданный код приглашения или null. */
  inviteCodeId: string | null;
  /** Сколько приглашений начислено или null. */
  grantedAmount: number | null;
  /** Причина решения или null. */
  decisionReason: string | null;
  /** Когда закрыта или null. */
  decidedAt: Date | null;
  /** Когда создана. */
  createdAt: Date;
}
