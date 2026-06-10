import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * Корневые маршруты (lazy):
 * - приватная зона `/app` (app-shell) под `authGuard`. Разделы внутри — F3.2+;
 * - публичная зона (cookie-гейт → главная → auth) под `PublicLayoutComponent`.
 *
 * ВАЖНО: `app` объявлен ПЕРЕД `''`. Публичная зона смонтирована на пустой путь и
 * содержит внутренний `**` (NotFound) — пустой путь с wildcard-ребёнком матчит любой
 * URL, поэтому если поставить его первым, он перехватит и `/app` (404 после логина).
 * Объявляя `app` выше, гарантируем матч `/app` раньше публичного `**`.
 */
export const routes: Routes = [
  {
    path: 'app',
    canActivate: [authGuard],
    loadChildren: () => import('./features/shell/shell.routes').then((m) => m.shellRoutes),
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
];
