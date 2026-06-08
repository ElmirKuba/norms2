import type { Routes } from '@angular/router';
import { ShellComponent } from './shell.component';

/**
 * Маршруты ЛК: `ShellComponent` как layout + дочерние lazy-разделы (рендерятся в
 * его `router-outlet`). default → **overview** (главный экран; сюда ведёт бренд,
 * профиль — отдельно из аккаунт-дропдауна). `u/:login` (чужой профиль) — F3.2.
 */
export const shellRoutes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('../overview/overview.component').then((m) => m.OverviewComponent) },
      { path: 'profile', loadComponent: () => import('../profile/profile.component').then((m) => m.ProfileComponent) },
      { path: 'invites', loadComponent: () => import('../invites/invites.component').then((m) => m.InvitesComponent) },
      { path: 'sessions', loadComponent: () => import('../sessions/sessions.component').then((m) => m.SessionsComponent) },
      { path: 'settings', loadComponent: () => import('../settings/settings.component').then((m) => m.SettingsComponent) },
    ],
  },
];
