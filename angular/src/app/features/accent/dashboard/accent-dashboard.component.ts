import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { AccentApiService } from '../services/accent-api.service';

/**
 * Дашборд раздела «Акцент» — каркас (2.0.0·6). Пока: пауза-тумблер (рабочий, через
 * `AccentApiService`). Метрики/«Сейчас»/прогресс — подфаза 2.10.
 */
@Component({
  selector: 'app-accent-dashboard',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dash">
      <h2>Дашборд</h2>
      <p>Каркас раздела. Метрики, «Сейчас» и прогресс появятся к 2.10.</p>
      <div class="dash__pause">
        @if (pausedFrom() === null) {
          <p>Раздел активен.</p>
          <app-button [loading]="busy()" (click)="pause()">Поставить на паузу</app-button>
        } @else {
          <p>На паузе с {{ pausedFrom() }} — серии и ролловер заморожены.</p>
          <app-button [loading]="busy()" (click)="resume()">Снять паузу</app-button>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .dash {
        padding: var(--space-5);
      }
      .dash__pause {
        margin-top: var(--space-4);
      }
      p {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AccentDashboardComponent {
  private readonly _api = inject(AccentApiService);

  /** Момент начала паузы (ISO) или null. */
  protected readonly pausedFrom = signal<string | null>(null);
  /** Идёт запрос паузы/снятия. */
  protected readonly busy = signal(false);

  public constructor() {
    this._load();
  }

  private _load(): void {
    this._api.getSettings().subscribe({
      next: (settings) => this.pausedFrom.set(settings.accentPausedFrom),
      error: () => undefined,
    });
  }

  protected pause(): void {
    this.busy.set(true);
    this._api.pause().subscribe({
      next: () => {
        this.busy.set(false);
        this._load();
      },
      error: () => this.busy.set(false),
    });
  }

  protected resume(): void {
    this.busy.set(true);
    this._api.resume().subscribe({
      next: () => {
        this.busy.set(false);
        this._load();
      },
      error: () => this.busy.set(false),
    });
  }
}
