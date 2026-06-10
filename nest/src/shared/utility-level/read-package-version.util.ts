import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Кэш прочитанной версии (package.json не меняется в рантайме). */
let cached: string | null = null;

/**
 * Версия бэкенда из его `package.json` (поле `version`). Читается через fs от
 * `process.cwd()` (в контейнере — `/app`, локально — `nest/`), один раз и кэшируется.
 * Импорт JSON не используем намеренно: `rootDir: src` это бы нарушило. При сбое —
 * безопасный fallback `'0.0.0'` (версия — не критичная для работы информация).
 * @returns Строка версии бэкенда.
 */
export function readBackendVersion(): string {
  if (cached !== null) {
    return cached;
  }
  try {
    const raw = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    cached = typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    cached = '0.0.0';
  }
  return cached;
}
