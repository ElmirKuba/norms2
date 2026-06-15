// Зеркало контракта `GET /api/v1/version` (ADR-0044, пересмотр 2026-06-15).

/** Версия развёрнутого билда: версия продукта + commit (диагностика). */
export interface VersionInfo {
  /** Версия продукта «Нормисы» (файл VERSION на бэке). */
  product: string;
  /** Короткий git-SHA билда или пустая строка. */
  commit: string;
}
