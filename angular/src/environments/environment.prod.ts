/**
 * Окружение prod. Фронт и API за одним доменом (Traefik, фаза D) → относительные
 * URL (`apiBase: ''`), без CORS.
 */
export const environment = {
  production: true,
  apiBase: '',
  appVersion: '1.0.0-beta',
};
