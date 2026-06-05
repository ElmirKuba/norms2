import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

/**
 * Корневая конфигурация приложения (standalone, без NgModule).
 * - роутер с lazy-маршрутами (`app.routes`);
 * - HttpClient (fetch) — под interceptor аутентификации (F1.4);
 * - анимации (async) — нужны единственной части Material: `MatDialog` (ADR-0025/0026).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),
  ],
};
