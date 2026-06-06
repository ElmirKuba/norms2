import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { AccountRead } from '../../../core/interfaces/account-read.interface';
import type {
  AccessTokenResponse,
  CheckInviteResponse,
  LoginCredentials,
  RecoveryCompleteInput,
  RecoveryStartResponse,
  RegisterInput,
  RegisterResponse,
  RegistrationMode,
} from '../auth.types';

/**
 * API-сервис auth/recovery: тонкая обёртка над HttpClient (URL относительные —
 * base/credentials/Bearer/refresh добавляет `authInterceptor`). Возвращает
 * Observable; экраны подписываются и маппят ошибки через `errorMessage`.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly _http = inject(HttpClient);

  /** Регистрация (токенов не выдаёт). */
  public register(input: RegisterInput): Observable<RegisterResponse> {
    return this._http.post<RegisterResponse>(`${API_PREFIX}/auth/register`, input);
  }

  /** Вход (access в теле, refresh в cookie). */
  public login(credentials: LoginCredentials): Observable<AccessTokenResponse> {
    return this._http.post<AccessTokenResponse>(`${API_PREFIX}/auth/login`, credentials);
  }

  /** Текущий аккаунт (после login/refresh — наполнить AuthStore). */
  public me(): Observable<AccountRead> {
    return this._http.get<AccountRead>(`${API_PREFIX}/accounts/me`);
  }

  /** Выход (отзыв сессии + очистка cookie). */
  public logout(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/auth/logout`, null);
  }

  /** Реактивация деактивированного по учётным данным. */
  public reactivate(credentials: LoginCredentials): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/auth/reactivate`, credentials);
  }

  /** Режим регистрации (free/invite). */
  public registrationMode(): Observable<RegistrationMode> {
    return this._http.get<RegistrationMode>(`${API_PREFIX}/auth/registration-mode`);
  }

  /** Предпроверка кода приглашения. */
  public checkInvite(code: string): Observable<CheckInviteResponse> {
    return this._http.post<CheckInviteResponse>(`${API_PREFIX}/invites/check`, { code });
  }

  /** Старт восстановления — K случайных вопросов по логину. */
  public recoveryStart(login: string): Observable<RecoveryStartResponse> {
    return this._http.post<RecoveryStartResponse>(`${API_PREFIX}/recovery/start`, { login });
  }

  /** Завершение восстановления — сверка ответов + новый пароль. */
  public recoveryComplete(input: RecoveryCompleteInput): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/recovery/complete`, input);
  }
}
