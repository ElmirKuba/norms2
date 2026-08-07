// Зеркало контракта уведомлений (`GET /api/v1/notifications`, F5.6).

import type { ReleaseContentFormat } from '../releases/releases.types';

/** Вид уведомления. */
export type NotificationKind = 'release' | 'system' | 'personal';

/** Проекция уведомления для смотрящего (с флагом прочтения). */
export interface NotificationView {
  /** PK. */
  id: string;
  /** Вид. */
  kind: NotificationKind;
  /** Заголовок. */
  title: string;
  /** Inline-текст или null (тогда контент в `contentFile`). */
  body: string | null;
  /** Путь к `.md` относительно content/ или null (тогда контент в `body` или это страница). */
  contentFile: string | null;
  /**
   * Формат содержимого (2.9.2·4). Колокольчик по нему выбирает способ открытия:
   * `md` — модалкой, `page` — переходом на лендинг в новой вкладке. Втискивать страницу с
   * прокруткой в модалку бессмысленно (реш. Elmir 05.08.2026).
   */
  contentFormat: ReleaseContentFormat;
  /**
   * Публичный ключ связанной публикации (`release-2.9.2`) или null у персональных.
   *
   * Нужен колокольчику, чтобы построить адрес лендинга `/releases/:key`. Внутренний `id`
   * публикации наружу не отдаётся — публичный адрес у релиза именно ключ (ADR-0065).
   */
  releaseKey: string | null;
  /** Момент создания (ISO-строка из JSON). */
  createdAt: string;
  /**
   * Дата ВЫПУСКА (2.9.1·15) или null у персональных уведомлений.
   *
   * Человеку показываем `publishedAt ?? createdAt`: у релиз-ноты `createdAt` — это когда
   * сидер положил строку в базу, а не когда вышел релиз.
   */
  publishedAt: string | null;
  /** Прочитано ли мной. */
  read: boolean;
}

/** Ответ счётчика непрочитанных. */
export interface UnreadCountResponse {
  /** Число непрочитанных. */
  count: number;
}
