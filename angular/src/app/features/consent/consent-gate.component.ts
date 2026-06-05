import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsentStore } from '../../core/consent/consent-store.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { CardComponent } from '../../shared/ui/card/card.component';

/**
 * Блокирующий cookie-гейт (ADR-0024): пока согласие не дано — единственное, что
 * видит пользователь. «Я согласен» → фиксирует согласие (приложение откроется);
 * «Покинуть сайт» → уход. Только технические cookie, без трекинга (152-ФЗ).
 */
@Component({
  selector: 'app-consent-gate',
  imports: [RouterLink, ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consent-gate.component.html',
  styleUrl: './consent-gate.component.scss',
})
export class ConsentGateComponent {
  private readonly _consent = inject(ConsentStore);

  /** Принять — приложение откроется. */
  protected accept(): void {
    this._consent.grant();
  }

  /** Уйти с сайта. */
  protected leave(): void {
    globalThis.location.href = 'about:blank';
  }
}
