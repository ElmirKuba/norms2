/** DI-токен порта уведомлений о личных событиях прогресса (биндится в progress.module). */
export const ACCENT_PROGRESS_NOTIFIER = Symbol('ACCENT_PROGRESS_NOTIFIER');

/**
 * Исходящий порт: «сообщить человеку о личном событии прогресса» — достижение (2.9·4) или веха
 * «держусь» (2.9·5). Домен знает **что сказать**, но не знает **как доставлено**: сегодня это
 * колокольчик фазы 1, завтра может добавиться push нативки (фаза 8).
 *
 * Реализация — `NotificationProgressNotifierAdapter` в этой же фиче.
 */
export interface AccentProgressNotifierPort {
  /**
   * Сообщает о случившемся. Best-effort: факт уже записан, доставка его не отменяет.
   * @param accountId Кому.
   * @param title Заголовок (название достижения или вехи).
   * @param body Текст.
   * @returns Промис завершения.
   */
  milestone(accountId: string, title: string, body: string): Promise<void>;
}
