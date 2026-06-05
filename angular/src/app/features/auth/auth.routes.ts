import type { Routes } from '@angular/router';
import { PublicLayoutComponent } from './public-layout.component';

/**
 * Маршруты публичной зоны (под `PublicLayoutComponent`). Экраны добавляются lazy
 * по мере готовности: landing (F2.3), register (F2.4), login (F2.5), recover (F2.6).
 * Гостевые роуты будут под `guestGuard` (аутентифицированного — в /app).
 */
export const authRoutes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      // F2.3: { path: '', loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent) },
      // F2.4: { path: 'register', canActivate: [guestGuard], loadComponent: ... },
      // F2.5: { path: 'login', canActivate: [guestGuard], loadComponent: ... },
      // F2.6: { path: 'recover', canActivate: [guestGuard], loadComponent: ... },
    ],
  },
];
