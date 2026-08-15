/**
 * RegisterAccountInput — вход сценария регистрации (сырые строки из DTO; VO
 * строятся внутри use-case). inviteCode — для invite-режима (этап I).
 */
export interface RegisterAccountInput {
  /** Логин. */
  login: string;
  /** Псевдоним. */
  alias: string;
  /** Пароль-плейнтекст. */
  password: string;
  /** Код приглашения (invite-режим). `| undefined` — под zod `.optional()` + exactOptional. */
  inviteCode?: string | undefined;
  /**
   * Часовой пояс устройства (IANA), если браузер сообщил (2.10·A1).
   *
   * Необязателен намеренно: регистрация не должна падать из-за часового пояса. Неизвестная зона
   * молча заменяется на `UTC` — как было раньше у всех.
   */
  timezone?: string | undefined;
}
