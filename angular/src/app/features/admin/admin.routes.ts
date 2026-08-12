import type { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';

/**
 * Маршруты технической админки (2.9.3·8). Раздел lazy: код грузится только тем, кто
 * действительно в него заходит, а таких единицы.
 */
export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin.component').then((m) => m.AdminComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'settings' },
      {
        path: 'people',
        loadComponent: () =>
          import('./people/admin-people.component').then((m) => m.AdminPeopleComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/admin-settings.component').then((m) => m.AdminSettingsComponent),
      },
    ],
  },
];
