/**
 * AccentSettingsFull — per-account настройки/состояние раздела «Акцент» (1:1 с
 * `account`; колонки 1:1 со схемой, ADR-0033). PK=FK=`accountId` (паттерн как у
 * Identity). `timezone` здесь НЕ хранится — это платформенное поле в `accounts`
 * (ADR-0028). `overall_streak_threshold` появится с сериями (подфаза 2.8, аддитивно).
 */
export interface AccentSettingsFull {
  /** PK = FK на `accounts.id` (1:1). */
  accountId: string;
  /** Начало паузы-режима (болезнь/отпуск) или null. Пауза замораживает серии/ролловер. */
  pausedFrom: Date | null;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}
