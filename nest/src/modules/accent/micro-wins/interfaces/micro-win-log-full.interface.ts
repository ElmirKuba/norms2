/**
 * MicroWinLogFull — факт выполнения микро-победы (колонки 1:1 со схемой, ADR-0033).
 * Иммутабельная запись (как PointEvent) — только `createdAt`, без `updatedAt`.
 * **Дневной лимит:** уникальность `(microWinId, occurredOn)` — 1 лог в день на победу
 * (повторный complete в тот же день — идемпотентный no-op). Даёт очки (геймификация 2.8).
 */
export interface MicroWinLogFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Какая микро-победа выполнена — FK на `micro_wins.id`. */
  microWinId: string;
  /** Локальная дата выполнения `YYYY-MM-DD` (в TZ аккаунта; ключ дневного лимита). */
  occurredOn: string;
  /** Когда зафиксировано. */
  createdAt: Date;
}
