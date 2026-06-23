import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { GOAL_DIRECTION_LABELS } from '../accent.types';
import type {
  GoalEntryView,
  GoalForecast,
  GoalProgressView,
  GoalStatus,
  MilestoneView,
} from '../accent.types';
import { GoalFormModalComponent } from './goal-form-modal.component';
import type { GoalFormData, GoalFormResult } from './goal-form-modal.component';

/** Размер страницы истории записей. */
const ENTRIES_PAGE = 30;

/** Подписи прогноза (проективный тон, ADR-0052). */
const FORECAST_LABELS: Readonly<Record<'ahead' | 'on_track' | 'behind', string>> = {
  ahead: 'Идёшь с опережением',
  on_track: 'В графике',
  behind: 'Стоит поднажать',
};

/**
 * Детальный экран цели (`/accent/goals/:id`, 2.5·17): визуализация прогресса (%/forecast/темп/
 * прогноз даты), **запись прогресса в один тап** (accumulate — «+N»; reach/reduce — замер),
 * история записей (cursor). Авто-завершение цели приходит с бэка в ответе на запись. Вехи —
 * 2.5·18, подцели — 2.5·19, lifecycle-контролы — 2.5·20. Прогресс считает бэк (ADR-0052).
 */
@Component({
  selector: 'app-goal-detail',
  imports: [RouterLink, ReactiveFormsModule, ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="gd">
      <button type="button" class="gd__back" (click)="back()">← К целям</button>

      @if (loading()) {
        <p class="gd__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="gd__error">{{ error() }}</p>
      } @else if (goal(); as g) {
        <header class="gd__head">
          <div class="gd__head-main">
            <span class="gd__badge">{{ directionLabel(g) }}</span>
            @if (g.status !== 'active') {
              <span class="gd__status">{{ statusLabel(g.status) }}</span>
            }
            <h2 class="gd__title">{{ g.title }}</h2>
            @if (g.whyItMatters) {
              <p class="gd__why">{{ g.whyItMatters }}</p>
            }
          </div>
          <app-button variant="ghost" (click)="openEdit(g)">Изменить</app-button>
        </header>

        <app-card>
          <div class="gd__progress">
            <div class="gd__pct">{{ g.percentage === null ? '—' : g.percentage + '%' }}</div>
            <div class="gd__bar"><span class="gd__bar-fill" [style.width.%]="g.percentage ?? 0"></span></div>
            <div class="gd__amount">{{ amountLabel(g) }}</div>
            <div class="gd__meta">
              @if (g.forecast) {
                <span class="gd__forecast gd__forecast--{{ g.forecast }}">{{ forecastLabel(g.forecast) }}</span>
              }
              @if (g.projectedCompletionDate) {
                <span class="gd__muted">При темпе — к {{ fmt(g.projectedCompletionDate) }}</span>
              }
              @if (deadlineLabel(g); as dl) {
                <span class="gd__muted">{{ dl }}</span>
              }
            </div>
          </div>
        </app-card>

        @if (g.parentGoalId === null) {
          <div class="gd__subgoals">
            <div class="gd__subgoals-head">
              <h3 class="gd__sub">Подцели</h3>
              <app-button variant="ghost" (click)="addSubgoal()">+ Подцель</app-button>
            </div>
            @if (children().length > 0) {
              <ul class="gd__children">
                @for (c of children(); track c.id) {
                  <li class="gd__child">
                    <a class="gd__child-link" [routerLink]="['../', c.id]">{{ c.title }}</a>
                    <span class="gd__child-pct">{{ c.percentage === null ? '—' : c.percentage + '%' }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="gd__muted">Пока нет подцелей. Большую цель можно разбить на шаги.</p>
            }
          </div>
        }

        @if (!g.rollup && g.status === 'active') {
          <app-card>
            <form class="gd__record" (ngSubmit)="record(g)">
              <label class="gd__rec-label">{{ recordLabel(g) }}</label>
              <div class="gd__rec-row">
                <input class="gd__input" type="number" step="any" [formControl]="valueControl"
                  [placeholder]="g.unit" />
                <app-button type="submit" [loading]="busy()">Записать</app-button>
              </div>
              @if (recordError()) {
                <span class="gd__error">{{ recordError() }}</span>
              }
            </form>
          </app-card>
        } @else if (g.rollup) {
          <p class="gd__muted">Прогресс этой цели складывается из подцелей — записывай его в них.</p>
        }

        <h3 class="gd__sub">Вехи</h3>
        @if (milestones().length > 0) {
          <ul class="gd__milestones">
            @for (m of milestones(); track m.id) {
              <li class="gd__ms" [class.gd__ms--done]="m.reached">
                <span class="gd__ms-check">{{ m.reached ? '✓' : '○' }}</span>
                <span class="gd__ms-title">{{ m.title }}</span>
                <span class="gd__ms-thr">{{ m.thresholdValue }} {{ g.unit }}</span>
                @if (!m.reached) {
                  <button type="button" class="gd__ms-del" aria-label="Удалить веху"
                    (click)="removeMilestone(m)">✕</button>
                }
              </li>
            }
          </ul>
        }
        @if (g.status === 'active') {
          <form class="gd__ms-form" (ngSubmit)="addMilestone()">
            <input class="gd__input" type="text" maxlength="160" [formControl]="msTitle"
              placeholder="Название вехи" />
            <input class="gd__input gd__input--thr" type="number" step="any" [formControl]="msThreshold"
              [placeholder]="'порог (' + g.unit + ')'" />
            <app-button type="submit" variant="ghost" [loading]="msBusy()">Добавить веху</app-button>
          </form>
          @if (msError()) {
            <span class="gd__error">{{ msError() }}</span>
          }
        }

        <h3 class="gd__sub">История</h3>
        @if (entries().length === 0) {
          <p class="gd__muted">Пока нет записей.</p>
        } @else {
          <ul class="gd__history">
            @for (e of entries(); track e.id) {
              <li class="gd__entry">
                <span class="gd__entry-val">{{ e.value > 0 ? '+' : '' }}{{ e.value }} {{ g.unit }}</span>
                <span class="gd__entry-date">{{ fmt(e.occurredOn) }}</span>
                @if (e.note) {
                  <span class="gd__entry-note">{{ e.note }}</span>
                }
              </li>
            }
          </ul>
          @if (hasMore()) {
            <app-button variant="ghost" [loading]="moreBusy()" (click)="loadMore()">Показать ещё</app-button>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .gd {
        padding: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .gd__back {
        align-self: flex-start;
        background: none;
        border: none;
        color: var(--color-accent);
        cursor: pointer;
        font-size: var(--fs-sm);
        padding: 0;
      }
      .gd__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .gd__badge {
        font-size: var(--fs-xs);
        color: var(--color-accent);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-1);
      }
      .gd__status {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
        margin-left: var(--space-2);
      }
      .gd__title {
        margin: var(--space-1) 0 0;
      }
      .gd__why {
        margin: var(--space-1) 0 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .gd__progress {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .gd__pct {
        font-size: var(--fs-xl, 2rem);
        font-weight: 700;
      }
      .gd__bar {
        position: relative;
        height: 10px;
        border-radius: 999px;
        background: var(--color-surface-2);
        overflow: hidden;
      }
      .gd__bar-fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--color-accent);
        border-radius: inherit;
        transition: width 0.3s ease;
      }
      .gd__amount {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .gd__meta {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
        align-items: center;
        font-size: var(--fs-sm);
      }
      .gd__forecast {
        font-size: var(--fs-xs);
        padding: 0 var(--space-2);
        border-radius: var(--radius-sm);
        border: 1px solid currentColor;
      }
      .gd__forecast--ahead {
        color: var(--color-accent);
      }
      .gd__forecast--on_track {
        color: var(--color-text-muted);
      }
      .gd__forecast--behind {
        color: var(--color-warning, #b8860b);
      }
      .gd__record {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .gd__rec-label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .gd__rec-row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
      }
      .gd__input {
        flex: 1;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
      }
      .gd__sub {
        margin: 0;
      }
      .gd__milestones {
        list-style: none;
        margin: 0 0 var(--space-2);
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .gd__ms {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .gd__ms-check {
        color: var(--color-text-muted);
      }
      .gd__ms--done .gd__ms-check {
        color: var(--color-accent);
      }
      .gd__ms--done .gd__ms-title {
        color: var(--color-text-muted);
        text-decoration: line-through;
      }
      .gd__ms-thr {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .gd__ms-del {
        margin-left: auto;
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
      }
      .gd__ms-del:hover {
        color: var(--color-danger);
      }
      .gd__ms-form {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: center;
      }
      .gd__input--thr {
        max-width: 140px;
      }
      .gd__subgoals-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .gd__children {
        list-style: none;
        margin: var(--space-2) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .gd__child {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .gd__child-link {
        color: var(--color-accent);
        text-decoration: none;
      }
      .gd__child-link:hover {
        text-decoration: underline;
      }
      .gd__child-pct {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .gd__history {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .gd__entry {
        display: flex;
        gap: var(--space-3);
        align-items: baseline;
        flex-wrap: wrap;
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--color-border);
      }
      .gd__entry-val {
        font-weight: 600;
      }
      .gd__entry-date {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .gd__entry-note {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        font-style: italic;
      }
      .gd__muted {
        color: var(--color-text-muted);
      }
      .gd__error {
        color: var(--color-danger);
      }
    `,
  ],
})
export class GoalDetailComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);

  /** Цель с прогрессом или null. */
  protected readonly goal = signal<GoalProgressView | null>(null);
  /** История записей. */
  protected readonly entries = signal<GoalEntryView[]>([]);
  /** Первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки. */
  protected readonly error = signal<string | null>(null);
  /** Идёт запись прогресса. */
  protected readonly busy = signal(false);
  /** Ошибка записи. */
  protected readonly recordError = signal<string | null>(null);
  /** Есть ли ещё история (для «Показать ещё»). */
  protected readonly hasMore = signal(false);
  /** Идёт догрузка истории. */
  protected readonly moreBusy = signal(false);
  /** Поле значения записи. */
  protected readonly valueControl = new FormControl<number | null>(null);
  /** Прямые подцели. */
  protected readonly children = signal<GoalProgressView[]>([]);
  /** Вехи цели. */
  protected readonly milestones = signal<MilestoneView[]>([]);
  /** Поле названия новой вехи. */
  protected readonly msTitle = new FormControl('', { nonNullable: true });
  /** Поле порога новой вехи. */
  protected readonly msThreshold = new FormControl<number | null>(null);
  /** Идёт добавление вехи. */
  protected readonly msBusy = signal(false);
  /** Ошибка вехи. */
  protected readonly msError = signal<string | null>(null);

  private readonly _id = this._route.snapshot.paramMap.get('id') ?? '';

  public constructor() {
    this._load();
  }

  /** Назад к списку целей. */
  protected back(): void {
    void this._router.navigate(['../'], { relativeTo: this._route });
  }

  /** RU-подпись рода. */
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

  /** Строка «сколько/из чего». */
  protected amountLabel(goal: GoalProgressView): string {
    if (goal.rollup) {
      return `${String(goal.subgoalsCompleted)} из ${String(goal.subgoalsTotal)} подцелей выполнено`;
    }
    const current = goal.currentValue === null ? '—' : String(goal.currentValue);
    const sep = goal.direction === 'accumulate' ? 'из' : '→';
    return `${current} ${sep} ${String(goal.targetValue)} ${goal.unit}`;
  }

  /** Подпись поля записи по роду. */
  protected recordLabel(goal: GoalProgressView): string {
    return goal.direction === 'accumulate' ? 'Добавить прогресс (+):' : 'Записать текущий замер:';
  }

  /** Подпись дедлайна. */
  protected deadlineLabel(goal: GoalProgressView): string {
    if (goal.deadline === null || goal.daysLeft === null) {
      return goal.deadline === null ? '' : `Срок: ${this.fmt(goal.deadline)}`;
    }
    if (goal.daysLeft < 0) {
      return `Срок прошёл (${this.fmt(goal.deadline)})`;
    }
    if (goal.daysLeft === 0) {
      return 'Срок сегодня';
    }
    return `Осталось ${String(goal.daysLeft)} дн.`;
  }

  /** Форматирует YYYY-MM-DD в «5 окт». */
  protected fmt(ymd: string): string {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(
      new Date(`${ymd.slice(0, 10)}T00:00:00`),
    );
  }

  /** Записывает прогресс (accumulate — инкремент; reach/reduce — замер). */
  protected record(goal: GoalProgressView): void {
    const value = this.valueControl.value;
    this.recordError.set(null);
    if (value === null || !Number.isFinite(value)) {
      this.recordError.set('Введи число.');
      return;
    }
    if (goal.direction === 'accumulate' && value === 0) {
      this.recordError.set('Вклад не может быть нулевым.');
      return;
    }
    this.busy.set(true);
    this._api.addGoalEntry(this._id, { value }).subscribe({
      next: (result) => {
        this.goal.set(result.goal);
        this.entries.update((list) => [result.entry, ...list]);
        this.valueControl.reset();
        this.busy.set(false);
      },
      error: (err: unknown) => {
        this.recordError.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }

  /** Открывает форму редактирования; на сохранении обновляет и перезагружает. */
  protected openEdit(goal: GoalProgressView): void {
    const ref = this._dialog.open<GoalFormModalComponent, GoalFormData, GoalFormResult | null>(
      GoalFormModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush', data: { goal } },
    );
    ref.afterClosed().subscribe((result) => {
      if (result && result.mode === 'update') {
        this._api.updateGoal(this._id, result.payload).subscribe({
          next: () => this._load(),
          error: () => undefined,
        });
      }
    });
  }

  /** Догружает историю по курсору. */
  protected loadMore(): void {
    const last = this.entries().at(-1);
    if (!last) {
      return;
    }
    this.moreBusy.set(true);
    this._api.listGoalEntries(this._id, last.id, ENTRIES_PAGE).subscribe({
      next: (page) => {
        this.entries.update((list) => [...list, ...page]);
        this.hasMore.set(page.length === ENTRIES_PAGE);
        this.moreBusy.set(false);
      },
      error: () => this.moreBusy.set(false),
    });
  }

  /** Открывает форму создания подцели (родитель предзадан). */
  protected addSubgoal(): void {
    const ref = this._dialog.open<GoalFormModalComponent, GoalFormData, GoalFormResult | null>(
      GoalFormModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush', data: { presetParentId: this._id } },
    );
    ref.afterClosed().subscribe((result) => {
      if (result && result.mode === 'create') {
        this._api.createGoal(result.payload).subscribe({
          next: () => this._load(),
          error: () => undefined,
        });
      }
    });
  }

  /** Добавляет веху. */
  protected addMilestone(): void {
    const title = this.msTitle.value.trim();
    const threshold = this.msThreshold.value;
    this.msError.set(null);
    if (title === '') {
      this.msError.set('Название вехи обязательно.');
      return;
    }
    if (threshold === null || !Number.isFinite(threshold)) {
      this.msError.set('Укажи порог числом.');
      return;
    }
    this.msBusy.set(true);
    this._api.addMilestone(this._id, { title, thresholdValue: threshold }).subscribe({
      next: () => {
        this.msTitle.reset();
        this.msThreshold.reset();
        this.msBusy.set(false);
        this._loadMilestones();
      },
      error: (err: unknown) => {
        this.msError.set(errorMessage(err));
        this.msBusy.set(false);
      },
    });
  }

  /** Удаляет (не достигнутую) веху. */
  protected removeMilestone(milestone: MilestoneView): void {
    this._api.removeMilestone(this._id, milestone.id).subscribe({
      next: () => this._loadMilestones(),
      error: () => undefined,
    });
  }

  private _load(): void {
    this.loading.set(true);
    this._api.getGoal(this._id).subscribe({
      next: (goal) => {
        this.goal.set(goal);
        this.error.set(null);
        this.loading.set(false);
        this._loadEntries();
        this._loadMilestones();
        this._loadChildren();
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private _loadEntries(): void {
    this._api.listGoalEntries(this._id, undefined, ENTRIES_PAGE).subscribe({
      next: (page) => {
        this.entries.set(page);
        this.hasMore.set(page.length === ENTRIES_PAGE);
      },
      error: () => undefined,
    });
  }

  private _loadMilestones(): void {
    this._api.listMilestones(this._id).subscribe({
      next: (items) => this.milestones.set(items),
      error: () => undefined,
    });
  }

  /** Грузит прямые подцели (фильтр всех целей по `parentGoalId`). */
  private _loadChildren(): void {
    this._api.listGoals().subscribe({
      next: (all) => this.children.set(all.filter((goal) => goal.parentGoalId === this._id)),
      error: () => undefined,
    });
  }
}
