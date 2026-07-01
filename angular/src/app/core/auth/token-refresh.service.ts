import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../config/api.constants';
import { AuthStore } from './auth-store.service';

/** Имя межвкладочного лока ротации (Web Locks API), уникально в рамках origin. */
const REFRESH_LOCK = 'norms-auth-refresh';

/**
 * Единый источник ротации refresh-токена для всего приложения (интерцептор на 401
 * и app-инициализатор идут только сюда). Гарантирует, что в один момент времени на
 * устройстве выполняется **не более одного** `POST /auth/refresh`:
 *
 * - **внутри вкладки** — мемоизация промиса (`_inFlight`): пачка параллельных 401
 *   дожидается одной ротации;
 * - **между вкладками одного браузера** — **Web Locks** (`navigator.locks`):
 *   вкладки сериализуются, вторая ротирует уже обновлённым (после первой) токеном.
 *
 * Так исключается benign-гонка двойного refresh тем же токеном — та самая, что
 * раньше срабатывала как reuse-detect и (в старой версии) отзывала все устройства
 * (кросс-девайс «кик», BUG-1). Разные устройства (Mac/Win) — независимые сессии с
 * независимыми токенами и cookie, между собой не конкурируют вовсе.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private readonly _http = inject(HttpClient);
  private readonly _authStore = inject(AuthStore);

  /** Ин-флайт ротации в этой вкладке (single-flight); null — ротация не идёт. */
  private _inFlight: Promise<string> | null = null;

  /**
   * Ротирует refresh-токен и кладёт новый access в стор. Возвращает новый
   * access-токен. Ошибку (невалидный/протухший токен) пробрасывает вызывающему —
   * реакцию (logout/редирект или «стать гостем») решает он сам.
   * @returns Новый access-токен.
   */
  public refresh(): Promise<string> {
    this._inFlight ??= this._runExclusive().finally((): void => {
      this._inFlight = null;
    });
    return this._inFlight;
  }

  /**
   * Выполняет ротацию под межвкладочным локом (если Web Locks доступен) — так
   * параллельные вкладки не предъявят один и тот же токен дважды.
   * @returns Новый access-токен.
   */
  private async _runExclusive(): Promise<string> {
    const rotate = async (): Promise<string> => {
      const { accessToken } = await firstValueFrom(
        this._http.post<{ accessToken: string }>(`${API_PREFIX}/auth/refresh`, null),
      );
      this._authStore.setAccessToken(accessToken);
      return accessToken;
    };
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      // `navigator.locks.request` резолвится значением коллбэка; await распрямляет
      // двойной Promise (тип request — Promise<колбэк-возврат>).
      return navigator.locks.request(REFRESH_LOCK, rotate);
    }
    return rotate();
  }
}
