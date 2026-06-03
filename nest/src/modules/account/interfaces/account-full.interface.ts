/**
 * AccountFull — полный контракт строки accounts (≈ строка БД, ADR-0033).
 * Ключи 1:1 соответствуют колонкам схемы; nullable-колонки — как `| null`
 * (ключ присутствует, значение nullable), не опциональные ключи.
 * На этапе A развернём в иерархию Pure → Base → Full.
 */
export interface AccountFull {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Логин (уникален по lower). */
  login: string;
  /** Отображаемое имя (не уникально). */
  alias: string;
  /** Путь к аватарке относительно content/ или null. */
  avatar: string | null;
  /** argon2id-хеш пароля. */
  passwordHash: string;
  /** Источник регистрации. */
  registrationSource: 'free' | 'invite' | 'seed';
  /** Остаток квоты инвайтов. */
  invitesRemaining: number;
  /** K вопросов для восстановления или null. */
  recoveryRequiredCount: number | null;
  /** IANA-таймзона. */
  timezone: string;
  /** Метка обратимой деактивации или null. */
  deactivatedAt: Date | null;
  /** Метка soft-delete или null. */
  deletedAt: Date | null;
  /** Версия для optimistic-lock (ADR-0035). */
  version: number;
  /** Когда создан. */
  createdAt: Date;
  /** Когда последний раз изменён. */
  updatedAt: Date;
}
