/**
 * Контракт ответа health-эндпоинта (liveness): подтверждает, что сервис живой.
 */
export interface HealthStatus {
  /** Состояние сервиса: 'ok' — процесс жив и отвечает. */
  status: 'ok';
  /** Аптайм процесса в секундах (целое). */
  uptimeSeconds: number;
  /** Метка времени формирования ответа (ISO 8601, UTC). */
  timestamp: string;
}
