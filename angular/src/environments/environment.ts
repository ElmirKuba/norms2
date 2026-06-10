import { version } from '../../package.json';

/**
 * Окружение dev. `apiBase` — абсолютный адрес бэка (nest на :3000); браузер шлёт
 * туда напрямую, CORS+credentials на бэке настроены под :4200. Прод заменяется
 * на `environment.prod.ts` (fileReplacements в angular.json). `frontendVersion` —
 * версия фронта из его `package.json` (ADR-0044); версию продукта и бэка фронт
 * берёт из `GET /api/v1/version`.
 */
export const environment = {
  production: false,
  apiBase: 'http://localhost:3000',
  frontendVersion: version,
};
