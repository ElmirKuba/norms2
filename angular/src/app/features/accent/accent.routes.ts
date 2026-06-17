import type { Routes } from '@angular/router';
import { AccentComponent } from './accent.component';

/**
 * Маршруты раздела «Акцент»: `AccentComponent` как layout (вкладки) + дочерние
 * lazy-экраны. default → дашборд. Микро-победы — рабочий экран (2.2·6); цели/привычки —
 * сид-заглушки (`AccentPlaceholderComponent`), наполнятся подфазами 2.3–2.11.
 */
export const accentRoutes: Routes = [
  {
    path: '',
    component: AccentComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/accent-dashboard.component').then((m) => m.AccentDashboardComponent),
      },
      {
        path: 'goals',
        loadComponent: () =>
          import('./accent-placeholder.component').then((m) => m.AccentPlaceholderComponent),
        data: { title: 'Цели' },
      },
      {
        path: 'habits',
        loadComponent: () =>
          import('./accent-placeholder.component').then((m) => m.AccentPlaceholderComponent),
        data: { title: 'Привычки' },
      },
      {
        path: 'micro-wins',
        loadComponent: () =>
          import('./micro-wins/micro-wins.component').then((m) => m.MicroWinsComponent),
      },
    ],
  },
];
