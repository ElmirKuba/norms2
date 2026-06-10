/**
 * Описание одной релиз-ноты для сида (F7). `contentFile` — путь и в репозиторном
 * `seed-content/`, и в раздаваемом `content/` (откуда бэк отдаёт `.md`).
 */
export interface ReleaseNoteSeed {
  /** Стабильный идемпотентный ключ (unique в notifications.key). */
  key: string;
  /** Заголовок (в БД и в шапке модалки). */
  title: string;
  /** Путь к `.md` относительно `content/` (и `seed-content/`). */
  contentFile: string;
}

/**
 * Релиз-ноты, которые сид гарантирует на старте (файл + broadcast-запись). Новые
 * релизы — добавлять сюда новой записью с новым `key`; повторный старт дублей не
 * создаёт (ON CONFLICT по `key`).
 */
export const RELEASE_NOTES: readonly ReleaseNoteSeed[] = [
  {
    key: 'release-1.0.0',
    title: 'Нормисы 1.0 — что уже внутри',
    contentFile: 'notifications/release-1.0.0.md',
  },
];
