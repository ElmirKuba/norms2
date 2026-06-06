import type { Routes } from '@angular/router';
import { PublicLayoutComponent } from './public-layout.component';
import { guestGuard } from '../../core/auth/guest.guard';

/**
 * Маршруты публичной зоны (под `PublicLayoutComponent`). landing (F2.3),
 * register (F2.4); login (F2.5), recover (F2.6) — далее. Гостевые экраны — под
 * `guestGuard` (аутентифицированного уводит в /app).
 */
export const authRoutes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent) },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent),
      },
      // F2.5: { path: 'login', canActivate: [guestGuard], loadComponent: ... },
      // F2.6: { path: 'recover', canActivate: [guestGuard], loadComponent: ... },
    ],
  },
];
