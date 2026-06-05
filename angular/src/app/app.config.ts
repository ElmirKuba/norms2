import type { ApplicationConfig } from '@angular/core';
import { provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { sessionInitializer } from './core/auth/session-initializer';

/**
 * Корневая конфигурация приложения (standalone, без NgModule).
 * - роутер с lazy-маршрутами (`app.routes`);
 * - HttpClient (fetch) + `authInterceptor` (Bearer/credentials/base, 401→refresh→повтор);
 * - app-initializer `sessionInitializer` (флаги + тихое восстановление сессии);
 * - анимации (async) — для единственной части Material: `MatDialog` (ADR-0025/0026).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppInitializer(sessionInitializer),
    provideAnimationsAsync(),
  ],
};
