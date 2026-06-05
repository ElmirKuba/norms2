import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_PREFIX } from '../config/api.constants';
import { AuthStore } from './auth-store.service';

/** Путь refresh — для него НЕ запускаем повторный refresh (иначе рекурсия). */
const REFRESH_PATH = `${API_PREFIX}/auth/refresh`;

/** Single-flight: общий поток refresh для всех параллельных 401. */
let refresh$: Observable<string> | null = null;

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
        void router.navigate(['/auth/login']);
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
  const apiBase = environment.apiBase;
  const isRefreshCall = request.url.includes(REFRESH_PATH);

  return next(decorate(request, authStore.accessToken(), apiBase)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isRefreshCall) {
        return throwError(() => error);
      }
      return runRefresh(http, apiBase, authStore, router).pipe(
        switchMap((token) => next(decorate(request, token, apiBase))),
      );
    }),
  );
};
