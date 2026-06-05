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
  template: `
    <div class="overlay">
      <app-card class="gate">
        <h1>Технические cookie</h1>
        <p>
          Нормисы используют только технические cookie (вход и сессия) — без рекламы и трекинга.
          Подробнее — в <a routerLink="/privacy">политике конфиденциальности</a>.
        </p>
        <div class="actions">
          <app-button (click)="accept()">Я согласен</app-button>
          <app-button variant="ghost" (click)="leave()">Покинуть сайт</app-button>
        </div>
      </app-card>
    </div>
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        padding: var(--space-4);
        background: var(--color-bg);
      }
      .gate {
        max-width: 440px;
      }
      h1 {
        font-size: var(--fs-xl);
        margin-bottom: var(--space-3);
      }
      p {
        color: var(--color-text-muted);
        margin-bottom: var(--space-5);
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
    `,
  ],
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
