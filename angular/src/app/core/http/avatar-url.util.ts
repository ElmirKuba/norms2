import { environment } from '../../../environments/environment';

/**
 * Абсолютный URL аватарки по пути из БД (`avatars/<id>.<ext>`, относительно
 * content/). Статику бэк отдаёт под `/content/` (ADR-0031). null → null (нет аватара).
 * @param path Путь из `account.avatar` или null.
 * @returns Полный URL или null.
 */
export function avatarUrl(path: string | null): string | null {
  if (path === null || path === '') {
    return null;
  }
  return `${environment.apiBase}/content/${path}`;
}
