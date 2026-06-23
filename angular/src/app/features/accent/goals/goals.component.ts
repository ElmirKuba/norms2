import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { GOAL_DIRECTION_LABELS } from '../accent.types';
import type { GoalForecast, GoalProgressView, GoalStatus } from '../accent.types';

/** Вариант фильтра по статусу (включая «все»). */
type StatusFilter = 'all' | GoalStatus;

/** Подписи фильтра статусов. */
const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Активные' },
  { value: 'completed', label: 'Достигнутые' },
  { value: 'paused', label: 'На паузе' },
  { value: 'archived', label: 'Архив' },
  { value: 'all', label: 'Все' },
];

/** Подписи прогноза (тон проективный, не обвиняющий — ADR-0052). */
const FORECAST_LABELS: Readonly<Record<'ahead' | 'on_track' | 'behind', string>> = {
  ahead: 'С опережением',
  on_track: 'В графике',
  behind: 'Стоит поднажать',
};

/**
 * Экран списка целей (`/accent/goals`) — заменяет заглушку-вкладку (закрывает находку ретро
 * P2.3 «мёртвая вкладка Цели»). Карточки с прогрессом/forecast/бейджем рода, фильтры по
 * статусу/сфере, пустой экран. Прогресс вычисляется на бэке (ADR-0052) — фронт только рисует.
 * Модалка создания/редактирования — 2.5·16; карточка с записью прогресса — 2.5·17; lifecycle —
 * 2.5·20. Тонкий слой над `AccentApiService`, Signals + OnPush + чистый SCSS.
 */
@Component({
  selector: 'app-goals',
  imports: [ButtonComponent, CardComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="goals">
      <header class="goals__head">
        <h2>Цели</h2>
        <span class="tooltip-host" [attr.data-tooltip]="'Создать цель'">
          <app-button ariaLabel="Создать цель" (click)="openCreate()">+</app-button>
        </span>
      </header>

      <div class="goals__filters" role="tablist" aria-label="Фильтр по статусу">
        @for (f of statusFilters; track f.value) {
          <button
            type="button"
            role="tab"
            class="goals__chip"
            [class.goals__chip--on]="statusFilter() === f.value"
            [attr.aria-selected]="statusFilter() === f.value"
            (click)="setStatus(f.value)"
          >{{ f.label }}</button>
        }
      </div>

      @if (loading()) {
        <p class="goals__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="goals__error">{{ error() }}</p>
      } @else if (items().length === 0) {
        <app-empty-state
          title="Целей пока нет"
          text="Цель — это куда ты идёшь: что накопить, какого уровня достичь или что снизить. Маленькие шаги складываются в большое."
        >
          <app-button (click)="openCreate()">
            <span aria-hidden="true">🎯</span>
            Создать цель
          </app-button>
        </app-empty-state>
      } @else {
        <ul class="goals__list">
          @for (g of items(); track g.id) {
            <li>
              <app-card>
                <div class="goals__item">
                  <div class="goals__top">
                    <span class="goals__badge">{{ directionLabel(g) }}</span>
                    @if (g.status !== 'active') {
                      <span class="goals__status goals__status--{{ g.status }}">{{ statusLabel(g.status) }}</span>
                    }
                    @if (g.domainKey) {
                      <span class="goals__domain">{{ g.domainKey }}</span>
                    }
                  </div>

                  <strong class="goals__name">{{ g.title }}</strong>
                  @if (g.whyItMatters) {
                    <span class="goals__why">{{ g.whyItMatters }}</span>
                  }

                  <div class="goals__bar" [attr.aria-label]="(g.percentage ?? 0) + '% выполнено'">
                    <span class="goals__bar-fill" [style.width.%]="g.percentage ?? 0"></span>
                  </div>

                  <div class="goals__metrics">
                    <span class="goals__pct">{{ g.percentage === null ? '—' : g.percentage + '%' }}</span>
                    <span class="goals__amount">{{ amountLabel(g) }}</span>
                    @if (g.forecast) {
                      <span class="goals__forecast goals__forecast--{{ g.forecast }}">
                        {{ forecastLabel(g.forecast) }}
                      </span>
                    }
                  </div>

                  @if (deadlineLabel(g); as dl) {
                    <span class="goals__deadline">{{ dl }}</span>
                  }
                </div>
              </app-card>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .goals {
        padding: var(--space-5);
      }
      .goals__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .goals__filters {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin: var(--space-3) 0 var(--space-4);
      }
      .goals__chip {
        padding: var(--space-1) var(--space-3);
        min-height: var(--touch-min);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill, 999px);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .goals__chip--on {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: var(--color-on-accent, #fff);
      }
      .goals__muted {
        color: var(--color-text-muted);
      }
      .goals__error {
        color: var(--color-danger);
      }
      .goals__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .goals__item {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-width: 0;
      }
      .goals__top {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .goals__badge {
        font-size: var(--fs-xs);
        color: var(--color-accent);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-1);
      }
      .goals__status {
        font-size: var(--fs-xs);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-1);
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
      }
      .goals__status--completed {
        color: var(--color-accent);
        border-color: var(--color-accent);
      }
      .goals__status--paused {
        color: var(--color-warning, #b8860b);
        border-color: var(--color-warning, #b8860b);
      }
      .goals__domain {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .goals__name {
        font-size: var(--fs-md);
      }
      .goals__why {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .goals__bar {
        position: relative;
        height: 8px;
        border-radius: var(--radius-pill, 999px);
        background: var(--color-surface-2);
        overflow: hidden;
      }
      .goals__bar-fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--color-accent);
        border-radius: inherit;
        transition: width 0.3s ease;
      }
      .goals__metrics {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
        font-size: var(--fs-sm);
      }
      .goals__pct {
        font-weight: 600;
      }
      .goals__amount {
        color: var(--color-text-muted);
      }
      .goals__forecast {
        margin-left: auto;
        font-size: var(--fs-xs);
        padding: 0 var(--space-2);
        border-radius: var(--radius-sm);
        border: 1px solid currentColor;
      }
      .goals__forecast--ahead {
        color: var(--color-accent);
      }
      .goals__forecast--on_track {
        color: var(--color-text-muted);
      }
      .goals__forecast--behind {
        color: var(--color-warning, #b8860b);
      }
      .goals__deadline {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class GoalsComponent {
  private readonly _api = inject(AccentApiService);

  /** Цели текущего фильтра. */
  protected readonly items = signal<GoalProgressView[]>([]);
  /** Первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка или null. */
  protected readonly error = signal<string | null>(null);
  /** Текущий фильтр статуса. */
  protected readonly statusFilter = signal<StatusFilter>('active');

  /** Опции фильтра статуса (для шаблона). */
  protected readonly statusFilters = STATUS_FILTERS;

  public constructor() {
    this._load();
  }

  /** Меняет фильтр статуса и перезагружает. */
  protected setStatus(value: StatusFilter): void {
    if (this.statusFilter() === value) {
      return;
    }
    this.statusFilter.set(value);
    this._load();
  }

  /** RU-подпись рода цели. */
  protected directionLabel(goal: GoalProgressView): string {
    return GOAL_DIRECTION_LABELS[goal.direction];
  }

  /** RU-подпись статуса. */
  protected statusLabel(status: GoalStatus): string {
    return status === 'completed'
      ? 'Достигнута'
      : status === 'paused'
        ? 'На паузе'
        : status === 'archived'
          ? 'В архиве'
          : 'Активна';
  }

  /** RU-подпись прогноза. */
  protected forecastLabel(forecast: GoalForecast): string {
    return forecast === null ? '' : FORECAST_LABELS[forecast];
  }

  /** Строка «сколько/из чего»: rollup → подцели; иначе текущее→цель в единицах. */
  protected amountLabel(goal: GoalProgressView): string {
    if (goal.rollup) {
      return `${String(goal.subgoalsCompleted)} из ${String(goal.subgoalsTotal)} подцелей`;
    }
    const current = goal.currentValue === null ? '—' : String(goal.currentValue);
    const sep = goal.direction === 'accumulate' ? '/' : '→';
    return `${current} ${sep} ${String(goal.targetValue)} ${goal.unit}`;
  }

  /** Подпись дедлайна: «осталось N дн.» / «срок прошёл» / дата прогноза. */
  protected deadlineLabel(goal: GoalProgressView): string {
    if (goal.deadline === null) {
      return goal.projectedCompletionDate === null
        ? ''
        : `При темпе — к ${this._fmt(goal.projectedCompletionDate)}`;
    }
    if (goal.daysLeft === null) {
      return `Срок: ${this._fmt(goal.deadline)}`;
    }
    if (goal.daysLeft < 0) {
      return `Срок прошёл (${this._fmt(goal.deadline)})`;
    }
    if (goal.daysLeft === 0) {
      return `Срок сегодня`;
    }
    return `Осталось ${String(goal.daysLeft)} дн. · до ${this._fmt(goal.deadline)}`;
  }

  /** Открывает форму создания цели. */
  protected openCreate(): void {
    // TODO: Claude Code: 2026-06-23: подключить модалку создания/редактирования цели — 2.5·16.
  }

  private _fmt(ymd: string): string {
    const date = new Date(`${ymd}T00:00:00`);
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  }

  private _load(): void {
    this.loading.set(true);
    const status = this.statusFilter();
    this._api.listGoals(status === 'all' ? undefined : status).subscribe({
      next: (items) => {
        this.items.set(items);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
