import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthStore } from './auth-store.service';

/**
 * Guard публичных auth-роутов: аутентифицированного уводит в приложение (`/app`),
 * чтобы не показывать login/register уже вошедшему.
 */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  return authStore.isAuthenticated() ? router.createUrlTree(['/app']) : true;
};
