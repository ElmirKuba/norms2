// Зеркало контракта overview-статистики (`GET /stats/overview`).

/** Агрегаты для главного экрана. */
export interface OverviewStats {
  /** Всего активных пользователей. */
  totalUsers: number;
  /** Сколько я пригласил напрямую. */
  invitedDirect: number;
  /** Всего в моём поддереве (транзитивно). */
  subtreeTotal: number;
  /** Из прямых приглашённых забанено мной (активно). */
  inviteesBannedByMe: number;
  /** Из прямых приглашённых забанено вышестоящими по дереву (не мной, активно). */
  inviteesBannedByAncestor: number;
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
  /** K или null. */
  recoveryRequiredCount: number | null;
}
