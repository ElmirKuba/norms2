import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { AccentApiService } from '../services/accent-api.service';
import type { GoalProgressView } from '../accent.types';

/**
 * Дашборд раздела «Акцент» — каркас (2.0.0·6) + блок «Цели в работе» (2.5·23 P2#4: цели
 * больше не изолированы — видны в ежедневном потоке). Полный кокпит «Сейчас» — подфаза 2.11.
 */
@Component({
  selector: 'app-accent-dashboard',
  imports: [RouterLink, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dash">
      <h2>Дашборд</h2>
      <p>Каркас раздела. Метрики и директивное «Сейчас» появятся к 2.11.</p>
      <div class="dash__pause">
        @if (pausedFrom() === null) {
          <p>Раздел активен.</p>
          <app-button [loading]="busy()" (click)="pause()">Поставить на паузу</app-button>
        } @else {
          <p>На паузе с {{ pausedLabel() }} — серии и ролловер заморожены.</p>
          <app-button [loading]="busy()" (click)="resume()">Снять паузу</app-button>
        }
      </div>

      @if (activeGoals().length > 0) {
        <div class="dash__goals">
          <h3>Цели в работе</h3>
          <ul class="dash__goal-list">
            @for (g of activeGoals(); track g.id) {
              <li class="dash__goal">
                <a class="dash__goal-link" [routerLink]="['../goals', g.id]">{{ g.title }}</a>
                <span class="dash__goal-bar">
                  <span class="dash__goal-fill" [style.width.%]="g.percentage ?? 0"></span>
                </span>
                <span class="dash__goal-pct">{{ g.percentage === null ? '—' : g.percentage + '%' }}</span>
              </li>
            }
          </ul>
          <a class="dash__goal-all" [routerLink]="['../goals']">Все цели →</a>
        </div>
      }
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
      .dash__goals {
        margin-top: var(--space-5);
      }
      .dash__goal-list {
        list-style: none;
        margin: var(--space-3) 0 var(--space-2);
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .dash__goal {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .dash__goal-link {
        color: var(--color-text);
        text-decoration: none;
        flex: 1;
        min-width: 0;
      }
      .dash__goal-link:hover {
        text-decoration: underline;
      }
      .dash__goal-bar {
        position: relative;
        width: 96px;
        height: 6px;
        border-radius: 999px;
        background: var(--color-surface-2);
        overflow: hidden;
        flex-shrink: 0;
      }
      .dash__goal-fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--color-accent);
        border-radius: inherit;
      }
      .dash__goal-pct {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        min-width: 3em;
        text-align: right;
      }
      .dash__goal-all {
        font-size: var(--fs-sm);
        color: var(--color-accent);
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
  /** Активные цели в работе (для блока на дашборде). */
  protected readonly activeGoals = signal<GoalProgressView[]>([]);

  /** Человекочитаемая дата начала паузы (ru-RU) или null — нативный Intl, без либ. */
  protected readonly pausedLabel = computed(() => {
    const iso = this.pausedFrom();
    return iso === null
      ? null
      : new Date(iso).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  });

  public constructor() {
    this._load();
  }

  /**
   *
   */
  private _load(): void {
    this._api.getSettings().subscribe({
      next: (settings) => { this.pausedFrom.set(settings.accentPausedFrom); },
      error: () => undefined,
    });
    this._api.listGoals('active').subscribe({
      // Примеры (is_starter) не считаются «в работе» — только присвоенные цели.
      next: (goals) => { this.activeGoals.set(goals.filter((g) => !g.isStarter).slice(0, 5)); },
      error: () => undefined,
    });
  }

  /**
   *
   */
  protected pause(): void {
    this.busy.set(true);
    this._api.pause().subscribe({
      next: () => {
        this.busy.set(false);
        this._load();
      },
      error: () => { this.busy.set(false); },
    });
  }

  /**
   *
   */
  protected resume(): void {
    this.busy.set(true);
    this._api.resume().subscribe({
      next: () => {
        this.busy.set(false);
        this._load();
      },
      error: () => { this.busy.set(false); },
    });
  }
}
