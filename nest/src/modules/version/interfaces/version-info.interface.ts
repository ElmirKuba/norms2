/**
 * Контракт `GET /version` (ADR-0044). Версия продукта — единый source of truth из
 * `.env`; версия бэка — из его `package.json`; commit — git-SHA развёрнутого билда
 * (пусто в dev). Версию фронта добавляет сам фронт (из своего `package.json`).
 */
export interface VersionInfo {
  /** Версия продукта «Нормисы» (PRODUCT_VERSION). */
  product: string;
  /** Версия бэкенда (nest/package.json). */
  backend: string;
  /** Короткий git-SHA билда или пустая строка. */
  commit: string;
}
