/**
 * Контракт `GET /version` (ADR-0044, пересмотр 2026-06-15). Версия продукта —
 * единый source of truth из файла `VERSION` в корне; commit — git-SHA развёрнутого
 * билда (пусто в dev). Версии фронта/бэка зафиксированы на 1.0.0 и не отдаются.
 */
export interface VersionInfo {
  /** Версия продукта «Нормисы» (файл VERSION). */
  product: string;
  /** Короткий git-SHA билда или пустая строка. */
  commit: string;
}
