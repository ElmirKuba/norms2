/**
 * Типы админки (2.9.3). Зеркало подмножества контракта бэка, нужное UI: типы фронта и бэка
 * не шарятся (ADR-0033). Даты приходят по HTTP строками.
 */

/** Настройка так, как её видит админка. */
export interface AdminSetting {
  /** Машинный ключ (`telegram.bot.paused`). */
  key: string;
  /** Действующее значение строкой. */
  value: string;
  /**
   * Откуда взялось действующее значение.
   *
   * Без этого поля «почему оно такое» не читается с экрана: `env` — начальное, строки в базе
   * ещё нет; `db` — кто-то переключил из админки.
   */
  source: 'env' | 'db';
  /** Кто менял последним или null (система либо значение из окружения). */
  updatedBy: string | null;
  /** Когда меняли последний раз (ISO) или null, если ни разу. */
  updatedAt: string | null;
}

/** Человек так, как его видит админка (2.9.3·10). */
export interface AdminAccount {
  /** PK аккаунта. */
  id: string;
  /** Логин. */
  login: string;
  /** Псевдоним. */
  alias: string;
  /** Коды ролей в нижнем регистре. */
  roles: string[];
  /** Как попал в продукт. */
  registrationSource: string;
  /** Остаток квоты приглашений. */
  invitesRemaining: number;
  /** Метка деактивации (ISO) или null. */
  deactivatedAt: string | null;
  /** Метка удаления (ISO) или null. */
  deletedAt: string | null;
  /** Когда зарегистрировался (ISO). */
  createdAt: string;
}

/** Страница списка людей: строки плюс курсор следующей. */
export interface AdminAccountPage {
  /** Строки страницы. */
  items: AdminAccount[];
  /** Курсор следующей страницы или null — это конец. */
  nextCursor: string | null;
}

/** Что человек просит у бота. */
export type AdminRequestType = 'join' | 'more_invites';

/** Где заявка в жизненном цикле. */
export type AdminRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Заявка из Telegram так, как её видит админка (2.9.3·11).
 *
 * Текста заявки здесь нет и не будет: он не хранится вовсе — только карточка «кто написал, чего
 * просит, чем закончилось». Сам текст живёт в переписке с ботом, и показать его может только бот.
 */
export interface AdminTelegramRequest {
  /** PK заявки. */
  id: string;
  /** Чат заявителя в Telegram. */
  chatId: string;
  /** Что просят. */
  type: AdminRequestType;
  /** Статус. */
  status: AdminRequestStatus;
  /** Аккаунт заявителя (только у просьбы о приглашениях) или null. */
  accountId: string | null;
  /** Логин этого аккаунта или null. */
  accountLogin: string | null;
  /** Выданный код приглашения или null. */
  inviteCodeId: string | null;
  /** Сколько приглашений начислено или null. */
  grantedAmount: number | null;
  /** Причина решения или null. */
  decisionReason: string | null;
  /** Когда закрыта (ISO) или null. */
  decidedAt: string | null;
  /** Когда создана (ISO). */
  createdAt: string;
}

/** Страница заявок: строки плюс общее число в этом статусе. */
export interface AdminTelegramRequestPage {
  /** Строки страницы. */
  items: AdminTelegramRequest[];
  /** Сколько всего заявок в выбранном статусе. */
  total: number;
}

/** Итог решения по заявке. */
export interface AdminRequestDecision {
  /** Заявка после решения. */
  request: AdminTelegramRequest;
  /**
   * Дошёл ли ответ до заявителя.
   *
   * **`false` — не ошибка, а состояние экрана.** Бот бывает на паузе или заблокирован: решение
   * записано, человек о нём не знает. Промолчать значило бы оставить админа в уверенности, что
   * ответ ушёл.
   */
  notified: boolean;
  /** Выданный код приглашения или null. */
  inviteCode: string | null;
}
