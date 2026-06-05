// Зеркало FeatureFlags бэка (GET /feature-flags).
export interface FeatureFlags {
  /** Открыта ли свободная регистрация (иначе — только по приглашению). */
  freeRegistration: boolean;
}
