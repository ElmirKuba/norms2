// Зеркало контракта `GET /api/v1/version` (ADR-0044).

/** Версия развёрнутого билда (бэк-часть; версию фронта добавляет фронт). */
export interface VersionInfo {
  /** Версия продукта «Нормисы» (PRODUCT_VERSION на бэке). */
  product: string;
  /** Версия бэкенда (nest/package.json). */
  backend: string;
  /** Короткий git-SHA билда или пустая строка. */
  commit: string;
}
