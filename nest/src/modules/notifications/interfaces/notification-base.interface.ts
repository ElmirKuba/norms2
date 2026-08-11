import type { NotificationPure } from './notification-pure.interface';

/**
 * NotificationBase — Pure + поля адресации (ADR-0033): `accountId` (null = broadcast всем,
 * set = персональное конкретному) и ссылка на публикацию.
 *
 * **Что отсюда УШЛО в contract-миграции 2.9.2·0** ([ADR-0065](../../../../../docs/decisions/0065-release-vs-notification-split.md)):
 * `key`, `contentFile`, `contentFormat`, `publishedAt`, `broadcastedAt`. Всё это — свойства
 * **публикации**, а не доставки, и с разделением они живут в `releases`. Пока шло переходное
 * время, колонки дублировались и читались через `coalesce`; после того как прод переехал на
 * новую модель, дубль стал источником расхождения — две правды об одном релизе.
 */
export interface NotificationBase extends NotificationPure {
  /** FK на accounts.id — адресат (null = broadcast всем). */
  accountId: string | null;
  /**
   * FK на `releases.id` — какую публикацию доставляет это уведомление (ADR-0065);
   * null у персональных и системных, где контент лежит прямо в `body`.
   *
   * `on delete cascade`: удалили релиз — исчезли и доставки, и отметки о прочтении.
   */
  releaseId: string | null;
}
