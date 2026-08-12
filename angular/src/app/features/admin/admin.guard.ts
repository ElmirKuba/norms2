import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';

/**
 * Пускает в `/app/admin` только аккаунт с ролью `admin` (2.9.3·8).
 *
 * ⚠️ **Это удобство, а не защита.** Данные охраняет бэк: без роли весь `/api/v1/admin/*`
 * отдаёт **404**, и никакая правка фронта этого не обходит. Guard нужен, чтобы человек не
 * попадал на экран, который всё равно ничего не покажет.
 *
 * Отказ ведёт на «страница не найдена», а не на «нет прав»: снаружи раздела просто не
 * существует — та же логика, что у бэка, и по той же причине (403 подтверждает, что ручка есть).
 */
export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  return authStore.isAdmin() ? true : router.createUrlTree(['/app/not-found']);
};
