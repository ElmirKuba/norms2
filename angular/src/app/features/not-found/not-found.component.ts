import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';

/**
 * Страница 404 (неизвестный маршрут). Подключается как `**` в публичной зоне
 * (под `PublicLayoutComponent`) и в `/app` (под app-shell). «На главную» —
 * контекстная: авторизованного ведёт в ЛК (`/app`), гостя — на публичную главную
 * (`/`), чтобы не выкидывать вошедшего на лендинг с Войти/Регистрацией.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  private readonly _auth = inject(AuthStore);

  /** Куда ведёт «На главную»: `/app` для авторизованного, `/` для гостя. */
  protected readonly homeLink = computed(() => (this._auth.account() ? '/app' : '/'));
}
