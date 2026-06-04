/**
 * RegistrationMode — текущий режим регистрации (GET /auth/registration-mode),
 * проверяется фронтом по клику «Регистрация» (ADR-0032).
 */
export interface RegistrationMode {
  /** true — свободная регистрация; false — только по приглашению. */
  freeRegistration: boolean;
}
