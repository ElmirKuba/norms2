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
