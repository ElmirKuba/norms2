/**
 * AccentSettingsView — проекция настроек раздела наружу (`GET /accent/settings`).
 * `timezone` — в профиле ЛК (ADR-0028), не здесь. `overallStreakThreshold` добавится
 * с сериями (2.8).
 */
export interface AccentSettingsView {
  /** Момент начала паузы-режима (ISO) или null (не на паузе). */
  accentPausedFrom: string | null;
}
