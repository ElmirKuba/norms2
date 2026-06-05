// Зеркало подмножества контракта бэка (AccountRead), нужное UI (ADR-0033;
// типы фронта и бэка не шарятся). Даты приходят по HTTP строками (ISO).
export interface AccountRead {
  /** PK, `uuidv7___unixmillis`. */
  id: string;
  /** Логин. */
  login: string;
  /** Псевдоним. */
  alias: string;
  /** Путь к аватарке относительно content/ или null. */
  avatar: string | null;
  /** Источник регистрации. */
  registrationSource: 'free' | 'invite' | 'seed';
  /** Остаток квоты инвайтов. */
  invitesRemaining: number;
  /** K вопросов восстановления или null (не настроено). */
  recoveryRequiredCount: number | null;
  /** IANA-таймзона. */
  timezone: string;
  /** Метка деактивации (ISO) или null. */
  deactivatedAt: string | null;
  /** Метка soft-delete (ISO) или null. */
  deletedAt: string | null;
  /** Когда создан (ISO). */
  createdAt: string;
  /** Когда изменён (ISO). */
  updatedAt: string;
}
