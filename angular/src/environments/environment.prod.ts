/**
 * Окружение prod. Фронт и API за одним доменом (Traefik, фаза D) → относительные
 * URL (`apiBase: ''`), без CORS. Версию продукта фронт берёт из
 * `GET /api/v1/version` (файл VERSION на бэке, ADR-0044).
 */
export const environment = {
  production: true,
  apiBase: '',
};
