import { version } from '../../package.json';

/**
 * Окружение prod. Фронт и API за одним доменом (Traefik, фаза D) → относительные
 * URL (`apiBase: ''`), без CORS. `frontendVersion` — версия фронта из его
 * `package.json` (ADR-0044).
 */
export const environment = {
  production: true,
  apiBase: '',
  frontendVersion: version,
};
