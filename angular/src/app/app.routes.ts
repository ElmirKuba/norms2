import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * Корневые маршруты (lazy):
 * - публичная зона (cookie-гейт → главная → auth) под `PublicLayoutComponent`;
 * - приватная зона `/app` (app-shell) под `authGuard`. Разделы внутри — F3.2+.
 */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
  },
];
