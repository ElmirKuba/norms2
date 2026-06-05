// Зеркала контракта auth/recovery (подмножество, нужное UI; не шарятся с бэком).

/** Вход для login/reactivate. */
export interface LoginCredentials {
  login: string;
  password: string;
}

/** Вход регистрации (inviteCode — в invite-режиме). */
export interface RegisterInput {
  login: string;
  alias: string;
  password: string;
  inviteCode?: string;
}

/** Ответ login/refresh: access-токен (refresh — в httpOnly-cookie). */
export interface AccessTokenResponse {
  accessToken: string;
}

/** Ответ регистрации (без токенов, ADR-0010). */
export interface RegisterResponse {
  id: string;
  login: string;
  alias: string;
}

/** Ответ предпроверки кода. */
export interface CheckInviteResponse {
  valid: boolean;
}

/** Режим регистрации. */
export interface RegistrationMode {
  freeRegistration: boolean;
}

/** Вопрос-челлендж восстановления. */
export interface RecoveryQuestion {
  id: string;
  question: string;
}

/** Ответ старта восстановления. */
export interface RecoveryStartResponse {
  questions: RecoveryQuestion[];
}

/** Ответ пользователя на вопрос. */
export interface RecoveryAnswer {
  questionId: string;
  answer: string;
}

/** Тело завершения восстановления. */
export interface RecoveryCompleteInput {
  login: string;
  answers: RecoveryAnswer[];
  newPassword: string;
}

/** Деталь активного бана (из `ACCOUNT_BANNED.details.bans`). */
export interface BannedDetail {
  bannerId: string;
  reason: string;
}
