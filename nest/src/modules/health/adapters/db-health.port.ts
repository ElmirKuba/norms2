/** DI-токен порта проверки доступности БД. */
export const DB_HEALTH = Symbol('DB_HEALTH');

/**
 * Порт health-проверки БД: домен (readiness) зависит от него, не от конкретного
 * DatabaseService. Реализуется инфра-слоем (`database/client/DatabaseService`).
 */
export interface DbHealthPort {
  /**
   * Пингует БД; бросает, если недоступна.
   * @returns Промис завершения при доступной БД.
   */
  ping(): Promise<void>;
}
