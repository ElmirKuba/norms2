// Зеркало контракта overview-статистики (`GET /stats/overview`).

/** Срез раздела «Акцент» для обзора ЛК (2.9·16). */
export interface AccentOverviewSnapshot {
  /** Задачи на сегодня. */
  today: {
    /** Закрыто. */
    done: number;
    /** Всего. */
    total: number;
    /** Процент закрытых. */
    percent: number;
  };
  /** Постоянство: итог и окно. */
  persistence: {
    /** Дней с действием всего — не падает никогда. */
    totalDays: number;
    /** Дней с действием внутри окна. */
    windowDays: number;
    /** Размер окна. */
    windowSize: number;
  };
  /** Одна фокусная цель или null. */
  focusGoal: {
    /** Идентификатор. */
    id: string;
    /** Название. */
    title: string;
    /** Прогресс 0..100. */
    percentage: number;
  } | null;
  /** Раздел на паузе. */
  isPaused: boolean;
  /** Есть ли своё содержимое (не только примеры). */
  hasContent: boolean;
}

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
  /** Срез раздела «Акцент» — приходит тем же запросом (серверная агрегация). */
  accent: AccentOverviewSnapshot;
}
