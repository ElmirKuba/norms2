/**
 * OverviewStats — числа для главного экрана (`GET /stats/overview`, F4). Только
 * агрегаты (счётчики), без списков/ПДн. Точечные значения «здесь и сейчас» (без
 * истории/трендов).
 */
export interface OverviewStats {
  /** Всего активных (не удалённых) пользователей. */
  totalUsers: number;
  /** Сколько я пригласил напрямую. */
  invitedDirect: number;
  /** Всего в моём поддереве (транзитивно). */
  subtreeTotal: number;
  /** Из прямых приглашённых забанено мной (активно) — для «полезности». */
  inviteesBannedByMe: number;
  /** Всего моих активных банов. */
  bansActive: number;
  /** Невыданных активных кодов. */
  pendingCodes: number;
  /** Остаток квоты приглашений. */
  invitesRemaining: number;
  /** Активных сессий (устройств). */
  activeSessions: number;
  /** Настроено секретных вопросов. */
  recoveryQuestions: number;
  /** K (сколько спрашивать) или null, если не задано. */
  recoveryRequiredCount: number | null;
}
