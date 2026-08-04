import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';

/** Состояние проверки приглашения. */
type InviteState = 'checking' | 'valid' | 'invalid';

/**
 * Страница-поздравление по ссылке-приглашению `/invite?code=CODE` (гостевая зона, под
 * `guestGuard`). Код проверяется **публичным** `POST /invites/check` — тем же, что и шаг кода в
 * регистрации. Валидный → праздничный экран + «Перейти к регистрации» (код прокидывается в
 * `/register` query-параметром, где авто-проверка пустит сразу к форме). Невалидный/истёкший или
 * подобранный «на удачу» → вежливое «приглашение не найдено», без поздравления.
 */
@Component({
  selector: 'app-invite',
  imports: [RouterLink, ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite.component.html',
  styleUrl: './invite.component.scss',
})
export class InviteComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  /** Нормализованный код из query (или null, если его нет / он короткий). */
  private readonly _code = signal<string | null>(null);
  /** Состояние проверки приглашения. */
  protected readonly state = signal<InviteState>('checking');
  /** Подпись пригласившего («мой брат», «по заявке через бота») или null. */
  protected readonly reason = signal<string | null>(null);

  public constructor() {
    const raw = this._route.snapshot.queryParamMap.get('code') ?? '';
    const code = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code.length < 10) {
      this.state.set('invalid');
      return;
    }
    this._code.set(code);
    this._api.checkInvite(code).subscribe({
      next: (res) => {
        this.reason.set(res.valid ? res.reason : null);
        this.state.set(res.valid ? 'valid' : 'invalid');
      },
      error: () => this.state.set('invalid'),
    });
  }

  /** Переход к регистрации с прокинутым валидным кодом. */
  protected goToRegister(): void {
    void this._router.navigate(['/register'], { queryParams: { code: this._code() } });
  }
}
