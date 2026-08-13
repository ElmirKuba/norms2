import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Запись журнала drizzle-kit — нас интересует только тег. */
interface JournalEntry {
  /** Имя файла миграции без расширения (`0046_quick_sersi`). */
  tag: string;
}

/** Файл `drizzle/meta/_journal.json`. */
interface Journal {
  /** Записи в порядке применения. */
  entries: JournalEntry[];
}

/** Кэш: файл в рантайме не меняется. */
let cached: string[] | null = null;

/**
 * Теги миграций из журнала drizzle-kit, в порядке применения (2.9.3·12).
 *
 * **Нужен, потому что база сама тег не хранит.** В `drizzle.__drizzle_migrations` лежат только
 * хеш и время — по строке нельзя сказать, какая это миграция. Ответ на вопрос «на какой версии
 * схемы поднялся контейнер» собирается из двух половин: сколько строк в базе (факт) и какие
 * миграции лежат в образе (ожидание). Расхождение и есть искомый сигнал.
 *
 * Читается от `process.cwd()` (в контейнере `/app/drizzle`) — папка попадает в рантайм-образ,
 * её же читает `drizzle-orm/migrator`. При сбое — пустой список: диагностика не должна ронять
 * ручку, ради которой её открыли.
 * @returns Теги миграций по порядку.
 */
export function readMigrationTags(): string[] {
  if (cached !== null) {
    return cached;
  }
  try {
    const raw = readFileSync(resolve(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8');
    const journal = JSON.parse(raw) as Journal;
    cached = journal.entries.map((entry) => entry.tag);
  } catch {
    cached = [];
  }
  return cached;
}
