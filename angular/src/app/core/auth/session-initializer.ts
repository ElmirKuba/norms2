import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../config/api.constants';
import { FeatureFlagsStore } from '../feature-flags/feature-flags-store.service';
import { AuthStore } from './auth-store.service';
import { TokenRefreshService } from './token-refresh.service';
import type { FeatureFlags } from '../interfaces/feature-flags.interface';
import type { AccountRead } from '../interfaces/account-read.interface';

/**
 * App-initializer (через `provideAppInitializer`): на старте (1) грузит флаги
 * площадки (`GET /feature-flags`) и (2) **тихо восстанавливает сессию** по
 * httpOnly refresh-cookie (`POST /auth/refresh` → `GET /accounts/me`). Это нужно,
 * чтобы после перезагрузки страницы (access-токен живёт в памяти и теряется)
 * guard не выкидывал на login при валидной cookie. Обе ветки best-effort —
 * ошибки не блокируют старт (флаги остаются дефолтными, пользователь — гостем).
 */
export function sessionInitializer(): Promise<void> {
  const http = inject(HttpClient);
  const flagsStore = inject(FeatureFlagsStore);
  const authStore = inject(AuthStore);
  const tokenRefresh = inject(TokenRefreshService);

  return (async (): Promise<void> => {
    try {
      const flags = await firstValueFrom(http.get<FeatureFlags>(`${API_PREFIX}/feature-flags`));
      flagsStore.set(flags);
    } catch {
      /* флаги недоступны — остаётся invite-only дефолт */
    }

    try {
      // Через единый координатор ротации (single-flight + Web Locks): восстановление
      // сессии на старте не конкурирует с refresh соседней вкладки тем же токеном.
      await tokenRefresh.refresh();
      const me = await firstValueFrom(http.get<AccountRead>(`${API_PREFIX}/accounts/me`));
      authStore.setAccount(me);
    } catch {
      /* нет валидной refresh-cookie — стартуем как гость */
    }
  })();
}
