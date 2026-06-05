import { DomainError } from './domain.error';

/** Деталь активного бана для конверта ответа (кто забанил + причина, ADR-0012). */
export interface BannedDetail {
  /** FK банившего. */
  bannerId: string;
  /** Причина бана. */
  reason: string;
}

/**
 * Вход/доступ заблокирован активным баном → HTTP 403, машинный код
 * `ACCOUNT_BANNED`. В `details.bans` — все активные баны (кто/за что, ADR-0012),
 * чтобы фронт показал экран «вы забанены».
 */
export class AccountBannedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ACCOUNT_BANNED';
  /** HTTP 403 Forbidden. */
  public readonly httpStatus = 403;

  /**
   * @param message Человекочитаемое сообщение.
   * @param activeBans Активные баны на аккаунт (берём только banner+reason).
   */
  public constructor(message: string, activeBans: ReadonlyArray<BannedDetail>) {
    // TODO: Claude Code: 2026-06-05: обогатить alias банившего (join accounts) —
    // сейчас в details только bannerId; фронт резолвит имя отдельно.
    super(message, { bans: activeBans.map((ban) => ({ bannerId: ban.bannerId, reason: ban.reason })) });
  }
}
