import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Кэш прочитанной версии (файл VERSION не меняется в рантайме). */
let cached: string | null = null;

/**
 * Версия продукта «Нормисы» из файла `VERSION` в корне — единый source of truth
 * (ADR-0044, пересмотр 2026-06-15). Читается через fs от `process.cwd()` (в
 * контейнере — `/app/VERSION`), один раз и кэшируется. При сбое — безопасный
 * fallback `'0.0.0'` (версия не критична для работы). Так `GET /version` честно
 * показывает, что реально развёрнуто.
 * @returns Строка версии продукта.
 */
export function readProductVersion(): string {
  if (cached !== null) {
    return cached;
  }
  try {
    cached = readFileSync(resolve(process.cwd(), 'VERSION'), 'utf8').trim() || '0.0.0';
  } catch {
    cached = '0.0.0';
  }
  return cached;
}
