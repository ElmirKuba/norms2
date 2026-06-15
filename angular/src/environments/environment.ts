/**
 * Окружение dev. `apiBase` — абсолютный адрес бэка (nest на :3000); браузер шлёт
 * туда напрямую, CORS+credentials на бэке настроены под :4200. Прод заменяется
 * на `environment.prod.ts` (fileReplacements в angular.json). Версию продукта
 * фронт берёт из `GET /api/v1/version` (файл VERSION на бэке, ADR-0044).
 */
export const environment = {
  production: false,
  apiBase: 'http://localhost:3000',
};
