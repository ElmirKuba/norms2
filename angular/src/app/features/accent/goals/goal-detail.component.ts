import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ModalService } from '../../../shared/modals/modal.service';
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
        @if (g.parentGoalId) {
          <button type="button" class="gd__back gd__back--parent" (click)="backToParent(g)">
            ↑ {{ parentTitle() ? 'К цели «' + parentTitle() + '»' : 'К родительской цели' }}
          </button>
        }
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
          <div class="gd__head-actions">
            <app-button variant="ghost" (click)="openEdit(g)">Изменить</app-button>
            <div class="gd__menu-wrap">
              <button type="button" class="gd__menu-btn" aria-label="Действия с целью"
                (click)="toggleMenu($event)">⋯</button>
              @if (menuOpen()) {
                <div class="gd__menu" (click)="$event.stopPropagation()">
                  @if (g.status === 'active') {
                    <button type="button" class="gd__menu-item" (click)="pause()">⏸ На паузу</button>
                    <button type="button" class="gd__menu-item" (click)="archive()">🗄 В архив</button>
                  } @else if (g.status === 'paused') {
                    <button type="button" class="gd__menu-item" (click)="resume()">▶ Снять с паузы</button>
                    <button type="button" class="gd__menu-item" (click)="archive()">🗄 В архив</button>
                  } @else if (g.status === 'completed') {
                    <button type="button" class="gd__menu-item" (click)="archive()">🗄 В архив</button>
                  } @else {
                    <button type="button" class="gd__menu-item" (click)="restore()">↩ Восстановить</button>
                  }
                </div>
              }
            </div>
          </div>
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
              @if (showDeadlineHint(g)) {
                <span class="gd__muted">Поставь срок, чтобы видеть прогноз к дате.</span>
              }
            </div>
          </div>
        </app-card>

        @if (chart(); as c) {
          <app-card>
            <div class="gd__chart-wrap">
              <span class="gd__chart-label">Динамика</span>
              <svg class="gd__chart" [attr.viewBox]="'0 0 ' + c.w + ' ' + c.h"
                preserveAspectRatio="none" role="img" aria-label="График прогресса">
                <polyline [attr.points]="c.points" fill="none" stroke="var(--color-accent)"
                  stroke-width="2" vector-effect="non-scaling-stroke" />
              </svg>
            </div>
          </app-card>
        }

        @if (g.fallbackVersion) {
          <aside class="gd__fallback">
            <span class="gd__fallback-icon" aria-hidden="true">🌱</span>
            <span class="gd__fallback-text">
              <strong>На плохой день:</strong> {{ g.fallbackVersion }}
            </span>
          </aside>
        }

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

        @if (g.isStarter) {
          <app-card>
            <div class="gd__adopt">
              <p class="gd__muted">Это пример. Добавь себе — и начни записывать прогресс (числа потом поправишь).</p>
              <app-button [loading]="adoptBusy()" (click)="adopt(g)">
                <span aria-hidden="true">➕</span> Добавить себе
              </app-button>
            </div>
          </app-card>
        } @else if (!g.rollup && g.status === 'active') {
          <app-card>
            <form class="gd__record" [formGroup]="recordForm" (ngSubmit)="record(g)">
              <label class="gd__rec-label">{{ recordLabel(g) }}</label>
              <div class="gd__rec-row">
                <input class="gd__input" type="number" step="any" formControlName="value"
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
          <form class="gd__ms-form" [formGroup]="msForm" (ngSubmit)="addMilestone()">
            <input class="gd__input" type="text" maxlength="160" formControlName="title"
              placeholder="Название вехи" />
            <input class="gd__input gd__input--thr" type="number" step="any" formControlName="thresholdValue"
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
                @if (editingId() === e.id) {
                  <input class="gd__entry-edit" type="number" step="any" [formControl]="editControl" />
                  <button type="button" class="gd__entry-btn" aria-label="Сохранить"
                    (click)="saveEntry(e)">✓</button>
                  <button type="button" class="gd__entry-btn" aria-label="Отмена"
                    (click)="cancelEdit()">↩</button>
                } @else {
                  <span class="gd__entry-val">{{ e.value > 0 ? '+' : '' }}{{ e.value }} {{ g.unit }}</span>
                  <span class="gd__entry-date">{{ fmt(e.occurredOn) }}</span>
                  @if (e.note) {
                    <span class="gd__entry-note">{{ e.note }}</span>
                  }
                  <span class="gd__entry-actions">
                    <button type="button" class="gd__entry-btn" aria-label="Изменить запись"
                      (click)="startEdit(e)">✎</button>
                    <button type="button" class="gd__entry-btn gd__entry-btn--danger"
                      aria-label="Удалить запись" (click)="removeEntry(e)">✕</button>
                  </span>
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
      .gd__head-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .gd__menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .gd__menu-btn {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-lg);
        line-height: 1;
      }
      .gd__menu-btn:hover {
        color: var(--color-text);
        border-color: var(--color-text-muted);
      }
      .gd__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        min-width: 180px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-1);
        overflow: hidden;
      }
      .gd__menu-item {
        text-align: left;
        padding: var(--space-2) var(--space-3);
        min-height: var(--touch-min);
        background: none;
        border: none;
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .gd__menu-item:hover {
        background: var(--color-surface-2);
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
      .gd__fallback {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-2);
        border-left: 3px solid var(--color-accent);
        border-radius: var(--radius-md);
      }
      .gd__fallback-icon {
        font-size: var(--fs-lg);
        line-height: 1.3;
      }
      .gd__fallback-text {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .gd__fallback-text strong {
        color: var(--color-text);
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
      .gd__adopt {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        align-items: flex-start;
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
      .gd__chart-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .gd__chart-label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .gd__chart {
        width: 100%;
        height: 60px;
        display: block;
      }
      .gd__entry {
        display: flex;
        gap: var(--space-3);
        align-items: center;
        flex-wrap: wrap;
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--color-border);
      }
      .gd__entry-actions {
        margin-left: auto;
        display: inline-flex;
        gap: var(--space-1);
      }
      .gd__entry-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-md);
        padding: 0 var(--space-1);
        min-width: var(--touch-min);
        min-height: var(--touch-min);
      }
      .gd__entry-btn:hover {
        color: var(--color-text);
      }
      .gd__entry-btn--danger:hover {
        color: var(--color-danger);
      }
      .gd__entry-edit {
        width: 120px;
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
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
  private readonly _modal = inject(ModalService);

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
  /** Открыто ли меню «⋯» действий с целью. */
  protected readonly menuOpen = signal(false);
  /** Идёт присвоение примера. */
  protected readonly adoptBusy = signal(false);
  /** Форма записи прогресса (FormGroup нужен, чтобы `(ngSubmit)` реально эмитился — ADR-триаж 2.5·23 #1). */
  protected readonly recordForm = new FormGroup({
    value: new FormControl<number | null>(null),
  });
  /** Id редактируемой записи истории (или null). */
  protected readonly editingId = signal<string | null>(null);
  /** Поле правки значения записи. */
  protected readonly editControl = new FormControl<number | null>(null);
  /** Прямые подцели. */
  protected readonly children = signal<GoalProgressView[]>([]);
  /** Заголовок родительской цели (для крошки «↑ К цели …») или null. */
  protected readonly parentTitle = signal<string | null>(null);
  /** Вехи цели. */
  protected readonly milestones = signal<MilestoneView[]>([]);
  /** Форма новой вехи (FormGroup — чтобы `(ngSubmit)` эмитился, см. триаж 2.5·23 #1). */
  protected readonly msForm = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    thresholdValue: new FormControl<number | null>(null),
  });
  /** Идёт добавление вехи. */
  protected readonly msBusy = signal(false);
  /** Ошибка вехи. */
  protected readonly msError = signal<string | null>(null);

  /**
   * Id текущей цели. Мутабельное поле (не `snapshot`-разовое): Angular переиспользует компонент при
   * навигации `goals/:id → goals/:otherId`, поэтому `_id` обновляется из подписки на `paramMap`
   * (триаж 2.5·23 F#3) — переход в подцель/соседнюю цель перезагружает экран без F5.
   */
  private _id = '';

  /**
   * SVG-спарклайн динамики из загруженных записей: для accumulate — нарастающая сумма, для
   * reach/reduce — сами замеры. null, если точек < 2 или цель rollup.
   */
  protected readonly chart = computed<{ points: string; w: number; h: number } | null>(() => {
    const goal = this.goal();
    if (goal === null || goal.rollup) {
      return null;
    }
    const sorted = [...this.entries()].sort((a, b) =>
      a.occurredOn === b.occurredOn ? a.id.localeCompare(b.id) : a.occurredOn.localeCompare(b.occurredOn),
    );
    if (sorted.length < 2) {
      return null;
    }
    let series: number[];
    if (goal.direction === 'accumulate') {
      let acc = 0;
      series = sorted.map((e) => (acc += e.value));
    } else {
      series = sorted.map((e) => e.value);
    }
    const W = 300;
    const H = 60;
    const pad = 4;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const n = series.length;
    const points = series
      .map((v, i) => {
        const x = pad + (i / (n - 1)) * (W - 2 * pad);
        const y = H - pad - ((v - min) / span) * (H - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { points, w: W, h: H };
  });

  public constructor() {
    // Реагируем на смену :id (Angular переиспользует инстанс компонента) — без этого переход в
    // подцель/соседнюю цель показал бы данные прошлой цели (триаж 2.5·23 F#3).
    this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';
      if (id === this._id) {
        return;
      }
      this._id = id;
      this._resetForNewGoal();
      this._load();
    });
  }

  /** Сбрасывает транзиентное состояние экрана при переходе на другую цель (чтобы не утекало). */
  private _resetForNewGoal(): void {
    this.goal.set(null);
    this.entries.set([]);
    this.milestones.set([]);
    this.children.set([]);
    this.parentTitle.set(null);
    this.hasMore.set(false);
    this.error.set(null);
    this.menuOpen.set(false);
    this.editingId.set(null);
    this.recordError.set(null);
    this.msError.set(null);
    this.recordForm.reset();
    this.msForm.reset();
  }

  /** К родительской цели (для подцели) — F#9: с подцели нельзя было уйти к родителю, только в список. */
  protected backToParent(goal: GoalProgressView): void {
    if (goal.parentGoalId === null) {
      return;
    }
    void this._router.navigate(['../', goal.parentGoalId], { relativeTo: this._route });
  }

  /** Назад к списку целей. */
  protected back(): void {
    void this._router.navigate(['../'], { relativeTo: this._route });
  }

  /** Переключает меню «⋯». */
  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  /** Клик вне меню / Escape — закрыть. */
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
  }

  /** Ставит цель на паузу. */
  protected pause(): void {
    this._lifecycle(this._api.pauseGoal(this._id));
  }

  /** Снимает цель с паузы. */
  protected resume(): void {
    this._lifecycle(this._api.resumeGoal(this._id));
  }

  /** Архивирует цель. */
  protected archive(): void {
    this._lifecycle(this._api.archiveGoal(this._id));
  }

  /** Восстанавливает цель из архива. */
  protected restore(): void {
    this._lifecycle(this._api.restoreGoal(this._id));
  }

  /**
   *
   */
  private _lifecycle(request: ReturnType<AccentApiService['pauseGoal']>): void {
    this.menuOpen.set(false);
    request.subscribe({
      next: () => { this._load(); },
      error: (err: unknown) => { this._modal.error('Не удалось изменить статус цели', errorMessage(err)); },
    });
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

  /** Строка «сколько/из чего» — для reduce/reach подчёркивает пройденный путь от старта. */
  protected amountLabel(goal: GoalProgressView): string {
    if (goal.rollup) {
      return `${String(goal.subgoalsCompleted)} из ${String(goal.subgoalsTotal)} подцелей выполнено`;
    }
    const current = goal.currentValue === null ? '—' : String(goal.currentValue);
    if (goal.direction === 'accumulate') {
      return `${current} из ${String(goal.targetValue)} ${goal.unit}`;
    }
    // reach/reduce: показываем путь старт → сейчас → цель (виден прогресс, а не «сколько осталось»).
    if (goal.startValue !== null) {
      return `старт ${String(goal.startValue)} · сейчас ${current} · цель ${String(goal.targetValue)} ${goal.unit}`;
    }
    return `сейчас ${current} · цель ${String(goal.targetValue)} ${goal.unit}`;
  }

  /** Показать ли подсказку «поставь срок» (бессрочная цель в работе, без forecast). */
  protected showDeadlineHint(goal: GoalProgressView): boolean {
    return (
      goal.deadline === null &&
      !goal.rollup &&
      goal.status === 'active' &&
      goal.percentage !== null &&
      goal.percentage < 100
    );
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
    const value = this.recordForm.controls.value.value;
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
        this._loadMilestones();
        this.recordForm.reset();
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
      if (result?.mode === 'update') {
        this._api.updateGoal(this._id, result.payload).subscribe({
          next: () => { this._load(); },
          error: (err: unknown) => { this._modal.error('Не удалось сохранить цель', errorMessage(err)); },
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
      error: () => { this.moreBusy.set(false); },
    });
  }

  /** Присваивает пример себе («Добавить себе») → перезагрузка. */
  protected adopt(goal: GoalProgressView): void {
    this.adoptBusy.set(true);
    this._api.adoptGoal(goal.id).subscribe({
      next: () => {
        this.adoptBusy.set(false);
        this._reloadGoal();
      },
      error: (err: unknown) => {
        this.adoptBusy.set(false);
        this._modal.error('Не удалось добавить себе', errorMessage(err));
      },
    });
  }

  /** Открывает форму создания подцели (родитель предзадан). */
  protected addSubgoal(): void {
    // Гард ДО формы (триаж 2.5·23 F#8): цель со своими записями не может стать родителем (P3#7,
    // rollup не смешивается со своими записями). Объясняем сразу, не давая впустую заполнять форму.
    if (this.entries().length > 0) {
      this._modal.error(
        'Подцели недоступны',
        'У цели уже есть прогресс — для такой цели нельзя создать подцель. Подцели можно добавлять только к цели без своих записей.',
      );
      return;
    }
    const ref = this._dialog.open<GoalFormModalComponent, GoalFormData, GoalFormResult | null>(
      GoalFormModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush', data: { presetParentId: this._id } },
    );
    ref.afterClosed().subscribe((result) => {
      if (result?.mode === 'create') {
        this._api.createGoal(result.payload).subscribe({
          next: () => { this._load(); },
          error: (err: unknown) => { this._modal.error('Не удалось создать подцель', errorMessage(err)); },
        });
      }
    });
  }

  /** Добавляет веху. */
  protected addMilestone(): void {
    const title = this.msForm.controls.title.value.trim();
    const threshold = this.msForm.controls.thresholdValue.value;
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
        this.msForm.reset();
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
      next: () => { this._loadMilestones(); },
      error: (err: unknown) => { this._modal.error('Не удалось удалить веху', errorMessage(err)); },
    });
  }

  /**
   *
   */
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
        this._loadParentTitle(goal.parentGoalId);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /**
   *
   */
  private _loadEntries(): void {
    this._api.listGoalEntries(this._id, undefined, ENTRIES_PAGE).subscribe({
      next: (page) => {
        this.entries.set(page);
        this.hasMore.set(page.length === ENTRIES_PAGE);
      },
      error: () => undefined,
    });
  }

  /**
   *
   */
  private _loadMilestones(): void {
    this._api.listMilestones(this._id).subscribe({
      next: (items) => { this.milestones.set(items); },
      error: () => undefined,
    });
  }

  /** Начинает правку записи (инлайн). */
  protected startEdit(entry: GoalEntryView): void {
    this.editingId.set(entry.id);
    this.editControl.setValue(entry.value);
  }

  /** Отменяет правку. */
  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  /** Сохраняет правку значения записи → пересчёт цели. */
  protected saveEntry(entry: GoalEntryView): void {
    const value = this.editControl.value;
    if (value === null || !Number.isFinite(value)) {
      return;
    }
    this._api.updateGoalEntry(this._id, entry.id, { value }).subscribe({
      next: (updated) => {
        this.entries.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
        this.editingId.set(null);
        this._reloadGoal();
      },
      error: (err: unknown) => { this._modal.error('Не удалось сохранить запись', errorMessage(err)); },
    });
  }

  /** Удаляет запись (с подтверждением) → пересчёт цели. */
  protected removeEntry(entry: GoalEntryView): void {
    void this._modal
      .confirm({
        title: 'Удалить запись?',
        text: `Запись «${entry.value > 0 ? '+' : ''}${String(entry.value)}» будет удалена, прогресс цели пересчитается.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .then((ok) => {
        if (!ok) {
          return;
        }
        this._api.removeGoalEntry(this._id, entry.id).subscribe({
          next: () => {
            this.entries.update((list) => list.filter((e) => e.id !== entry.id));
            this._reloadGoal();
          },
          error: (err: unknown) => { this._modal.error('Не удалось удалить запись', errorMessage(err)); },
        });
      });
  }

  /**
   * Перечитывает цель (свежий currentValue/%) И вехи — `reached` зависит от текущего значения,
   * поэтому после любой мутации прогресса обновляем их реактивно, без перезагрузки страницы
   * (триаж 2.5·23 F#2). Покрывает правку/удаление записи.
   */
  private _reloadGoal(): void {
    this._api.getGoal(this._id).subscribe({
      next: (goal) => { this.goal.set(goal); },
      error: () => undefined,
    });
    this._loadMilestones();
  }

  /** Грузит заголовок родителя для крошки (F#9-полировка); null, если цель — корень. */
  private _loadParentTitle(parentGoalId: string | null): void {
    if (parentGoalId === null) {
      this.parentTitle.set(null);
      return;
    }
    this._api.getGoal(parentGoalId).subscribe({
      next: (parent) => { this.parentTitle.set(parent.title); },
      error: () => undefined,
    });
  }

  /** Грузит прямые подцели (эндпоинт `/children`, P3#5). */
  private _loadChildren(): void {
    this._api.listChildGoals(this._id).subscribe({
      next: (items) => { this.children.set(items); },
      error: () => undefined,
    });
  }
}
