import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthStore } from './auth-store.service';

/**
 * Guard приватных маршрутов: пускает аутентифицированных, иначе ведёт на login.
 * Восстановление сессии по refresh-cookie происходит в app-initializer ДО роутинга
 * (`sessionInitializer`), поэтому к моменту guard'а `isAuthenticated` уже актуален.
 */
export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  return authStore.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
