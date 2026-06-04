/**
 * FeatureFlags — флаги площадки, отдаются фронту на старте (GET /feature-flags).
 */
export interface FeatureFlags {
  /** Открыта ли свободная регистрация (иначе — только по приглашению). */
  freeRegistration: boolean;
}
