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
}
