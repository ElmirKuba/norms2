import type { Routes } from '@angular/router';

/**
 * Корневые маршруты (lazy). Каркас фазы 1:
 * - публичная зона (cookie-гейт → главная → auth) — наполняется в F2.1/F2.2/F2.3-F2.5;
 * - приватная зона (app-shell + разделы под guard) — в F3.1+.
 * Конкретные `loadComponent`/`loadChildren` добавляются по мере готовности экранов,
 * guard аутентификации (F1.4) — на приватную ветку.
 */
export const routes: Routes = [
  // Публичная зона (landing + auth) под `PublicLayoutComponent`.
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  // F3: { path: 'app', canActivate: [authGuard], loadChildren: () => import('./features/shell/shell.routes')... },
];
