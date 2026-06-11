import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_PREFIX } from '../config/api.constants';
import { AuthStore } from './auth-store.service';
import { ModalService } from '../../shared/modals/modal.service';

/** Деталь активного бана из конверта `ACCOUNT_BANNED.details.bans`. */
interface BannedDetail {
  bannerId: string;
  bannerLogin: string;
  bannerAlias: string;
  reason: string;
}

/** Single-flight: не показывать модалку бана дважды на пачку параллельных 403. */
let bannedHandling = false;

/**
 * Credential-эндпоинты: на их 401 НЕ запускаем refresh — это «неверные данные»,
 * а не истёкший токен (иначе login/register с плохими данными уходил бы в refresh
 * вместо нормальной ошибки; для refresh — защита от рекурсии).
 */
const NO_REFRESH_PATHS = [
  `${API_PREFIX}/auth/login`,
  `${API_PREFIX}/auth/register`,
  `${API_PREFIX}/auth/reactivate`,
  `${API_PREFIX}/auth/refresh`,
];

/** Single-flight: общий поток refresh для всех параллельных 401. */
let refresh$: Observable<string> | null = null;

/** Машинный код ошибки из конверта `{error:{code}}` или null. */
function errorCodeOf(error: HttpErrorResponse): string | null {
  if (error.error !== null && typeof error.error === 'object') {
    return (error.error as { error?: { code?: string } }).error?.code ?? null;
  }
  return null;
}

/** Список банов из `ACCOUNT_BANNED.details.bans`. */
function extractBans(error: HttpErrorResponse): BannedDetail[] {
  if (error.error !== null && typeof error.error === 'object') {
    const details = (error.error as { error?: { details?: { bans?: BannedDetail[] } } }).error?.details;
    return details?.bans ?? [];
  }
  return [];
}

/**
 * Реакция на бан (403 `ACCOUNT_BANNED` на любом защищённом запросе, ADR-0038):
 * сбрасывает сессию, уводит на главную и показывает «вы забанены: за что». Покрывает
 * и восстановление сессии забаненным, и мгновенный бан в процессе работы. Single-
 * flight — на пачку параллельных 403 модалка одна.
 */
function handleBanned(
  error: HttpErrorResponse,
  authStore: AuthStore,
  router: Router,
  modal: ModalService,
): void {
  if (bannedHandling) {
    return;
  }
  bannedHandling = true;
  authStore.clear();
  void router.navigate(['/']);
  const bans = extractBans(error);
  const text =
    bans.length > 0
      ? bans.map((ban) => `• ${ban.bannerAlias} (@${ban.bannerLogin}): ${ban.reason}`).join('<br>')
      : 'Доступ к аккаунту закрыт.';
  modal.error('Вы забанены', text);
  setTimeout(() => {
    bannedHandling = false;
  }, 1000);
}

/**
 * Достраивает запрос: относительный `/api/...` → абсолютный (`apiBase`), вешает
 * `Authorization: Bearer` (если есть токен) и `withCredentials` (refresh-cookie).
 */
function decorate<T>(request: HttpRequest<T>, token: string | null, apiBase: string): HttpRequest<T> {
  const url = request.url.startsWith('http') ? request.url : `${apiBase}${request.url}`;
  const headers = token === null ? request.headers : request.headers.set('Authorization', `Bearer ${token}`);
  return request.clone({ url, headers, withCredentials: true });
}

/**
 * Запускает (или переиспользует) ротацию: `POST /auth/refresh` по cookie. Успех →
 * кладёт новый access в стор и отдаёт его; провал → сбрасывает сессию и ведёт на
 * login. `shareReplay`+memo — один refresh на пачку одновременных 401.
 */
function runRefresh(http: HttpClient, apiBase: string, authStore: AuthStore, router: Router): Observable<string> {
  if (refresh$ !== null) {
    return refresh$;
  }
  refresh$ = http
    .post<{ accessToken: string }>(`${API_PREFIX}/auth/refresh`, null)
    .pipe(
      map((response): string => {
        authStore.setAccessToken(response.accessToken);
        return response.accessToken;
      }),
      catchError((error: unknown) => {
        authStore.clear();
        void router.navigate(['/login']);
        return throwError(() => error);
      }),
      finalize(() => {
        refresh$ = null;
      }),
      shareReplay(1),
    );
  return refresh$;
}

/**
 * HTTP-интерсептор аутентификации (ADR-0020): подставляет Bearer/credentials/base,
 * на `401` (кроме самого refresh) — ротирует токен и повторяет исходный запрос.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const http = inject(HttpClient);
  const modal = inject(ModalService);
  const apiBase = environment.apiBase;
  const skipRefresh = NO_REFRESH_PATHS.some((path) => request.url.includes(path));

  return next(decorate(request, authStore.accessToken(), apiBase)).pipe(
    catchError((error: unknown) => {
      // Бан на ЗАЩИЩЁННОМ запросе (me, инвайты и т.п.) — глобально. На credential-
      // эндпоинтах (login/register/reactivate) бан показывает сам компонент.
      if (
        !skipRefresh &&
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        errorCodeOf(error) === 'ACCOUNT_BANNED'
      ) {
        handleBanned(error, authStore, router, modal);
        return throwError(() => error);
      }
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || skipRefresh) {
        return throwError(() => error);
      }
      return runRefresh(http, apiBase, authStore, router).pipe(
        switchMap((token) => next(decorate(request, token, apiBase))),
      );
    }),
  );
};
