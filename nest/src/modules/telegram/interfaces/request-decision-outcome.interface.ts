import type { TelegramRequestReviewView } from './telegram-request-review-view.interface';

/**
 * Итог решения по заявке (2.9.3·11) — общий для бота и админки.
 */
export interface RequestDecisionOutcome {
  /** Заявка после решения. */
  request: TelegramRequestReviewView;
  /**
   * Дошёл ли ответ до заявителя.
   *
   * **`false` — не ошибка, а состояние.** Бот бывает на паузе или заблокирован человеком:
   * решение записано, а заявитель о нём не знает. Промолчать об этом значило бы оставить
   * решающего в уверенности, что ответ ушёл.
   */
  notified: boolean;
  /** Выданный код приглашения (у одобренной заявки на вступление) или null. */
  inviteCode: string | null;
}
