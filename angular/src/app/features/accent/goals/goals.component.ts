import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { HscrollHintDirective } from '../../../shared/ui/hscroll-hint.directive';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { ModalService } from '../../../shared/modals/modal.service';
import { ModalHeaderClassIcon } from '../../../shared/modals/dialog-modal/dialog-modal.types';
import { AccentApiService } from '../services/accent-api.service';
import { GOAL_DIRECTION_LABELS } from '../accent.types';
import type { AccentRefItem, GoalForecast, GoalProgressView, GoalStatus } from '../accent.types';
import { GoalFormModalComponent } from './goal-form-modal.component';
import type { GoalFormData, GoalFormResult } from './goal-form-modal.component';

/** Вариант фильтра по статусу (включая «все»). */
type StatusFilter = 'all' | GoalStatus;

/** Подписи фильтра статусов. */
const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
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
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    RouterLink,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    HscrollHintDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="goals">
      <header class="goals__head">
        <h2>Цели</h2>
        <div class="goals__head-actions" appHscrollHint [appHscrollHintDelay]="1300">
          @if (items().length > 0) {
            @if (hasStarters()) {
              <app-button variant="ghost" [loading]="packBusy()" (click)="clearExamples()">
                <span aria-hidden="true">🧹</span> Очистить примеры
              </app-button>
            } @else {
              <app-button variant="ghost" [loading]="packBusy()" (click)="seedPack()">
                <span aria-hidden="true">🎁</span> Получить пак
              </app-button>
            }
          }
          <span class="tooltip-host" [attr.data-tooltip]="'Создать цель'">
            <app-button ariaLabel="Создать цель" (click)="openCreate()">+</app-button>
          </span>
        </div>
      </header>

      <div class="goals__filters" role="tablist" aria-label="Фильтр по статусу"
        appHscrollHint [appHscrollHintDelay]="1300">
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

      @if (domains().length > 0) {
        <label class="goals__domain-filter">
          <span class="goals__domain-label">Сфера:</span>
          <select class="goals__domain-select" [value]="domainFilter()"
            (change)="setDomain($any($event.target).value)">
            <option value="">Все сферы</option>
            @for (d of domains(); track d.key) {
              <option [value]="d.key">{{ d.title }}</option>
            }
          </select>
        </label>
      }

      @if (loading()) {
        <p class="goals__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="goals__error">{{ error() }}</p>
      } @else if (items().length === 0) {
        <app-empty-state
          title="Целей пока нет"
          text="Цель — это куда ты идёшь: что накопить, какого уровня достичь или что снизить. Можно начать с готовых примеров или создать свою."
        >
          <app-button [loading]="packBusy()" (click)="seedPack()">
            <span aria-hidden="true">🎁</span>
            Получить примеры целей
          </app-button>
          <app-button variant="ghost" (click)="openCreate()">
            <span aria-hidden="true">🎯</span>
            Создать свою
          </app-button>
        </app-empty-state>
      } @else {
        @if (hasStarters()) {
          <p class="goals__hint">Примеры помечены бейджем. «Добавить себе» или «Изм.» — и пример станет твоей целью.</p>
        }
        <h3 class="goals__section">⭐ В фокусе</h3>
        <ul class="goals__list goals__focus-zone" cdkDropList #focusList="cdkDropList"
          [cdkDropListConnectedTo]="[othersList]" (cdkDropListDropped)="dropOnFocus($event)">
          @for (g of focusedItems(); track g.id) {
            <li cdkDrag [cdkDragData]="g">
              <app-card>
                <div class="goals__item">
                  <div class="goals__top">
                    <button type="button" class="goals__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                    <span class="goals__badge">{{ directionLabel(g) }}</span>
                    @if (g.isStarter) { <span class="goals__badge goals__badge--example">пример</span> }
                    @if (g.status !== 'active') { <span class="goals__status goals__status--{{ g.status }}">{{ statusLabel(g.status) }}</span> }
                    @if (g.domainKey) { <span class="goals__domain">{{ g.domainKey }}</span> }
                    <button type="button" class="goals__star goals__star--on" aria-label="Убрать из фокуса"
                      [disabled]="focusBusy()" (click)="toggleFocus(g)">★</button>
                  </div>
                  <a class="goals__name" [routerLink]="[g.id]">{{ g.title }}</a>
                  @if (g.whyItMatters) { <span class="goals__why">{{ g.whyItMatters }}</span> }
                  <div class="goals__bar" [attr.aria-label]="(g.percentage ?? 0) + '% выполнено'">
                    <span class="goals__bar-fill" [style.width.%]="g.percentage ?? 0"></span>
                  </div>
                  <div class="goals__metrics">
                    <span class="goals__pct">{{ g.percentage === null ? '—' : g.percentage + '%' }}</span>
                    <span class="goals__amount">{{ amountLabel(g) }}</span>
                    @if (g.forecast) { <span class="goals__forecast goals__forecast--{{ g.forecast }}">{{ forecastLabel(g.forecast) }}</span> }
                  </div>
                  @if (deadlineLabel(g); as dl) { <span class="goals__deadline">{{ dl }}</span> }
                </div>
              </app-card>
            </li>
          } @empty {
            <li class="goals__focus-empty">Перетащи цель сюда — возьмёшь в фокус ⭐</li>
          }
        </ul>

        <h3 class="goals__section goals__section--muted">Остальные</h3>
        <ul class="goals__list" cdkDropList #othersList="cdkDropList"
          [cdkDropListConnectedTo]="[focusList]" (cdkDropListDropped)="dropOnOthers($event)">
          @for (g of unfocusedItems(); track g.id) {
            <li cdkDrag [cdkDragData]="g">
              <app-card>
                <div class="goals__item">
                  <div class="goals__top">
                    <button type="button" class="goals__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                    <span class="goals__badge">{{ directionLabel(g) }}</span>
                    @if (g.isStarter) { <span class="goals__badge goals__badge--example">пример</span> }
                    @if (g.status !== 'active') { <span class="goals__status goals__status--{{ g.status }}">{{ statusLabel(g.status) }}</span> }
                    @if (g.domainKey) { <span class="goals__domain">{{ g.domainKey }}</span> }
                    @if (!g.isStarter && g.status === 'active') {
                      <button type="button" class="goals__star" aria-label="Добавить в фокус"
                        [disabled]="focusBusy()" (click)="toggleFocus(g)">☆</button>
                    }
                  </div>
                  <a class="goals__name" [routerLink]="[g.id]">{{ g.title }}</a>
                  @if (g.whyItMatters) { <span class="goals__why">{{ g.whyItMatters }}</span> }
                  <div class="goals__bar" [attr.aria-label]="(g.percentage ?? 0) + '% выполнено'">
                    <span class="goals__bar-fill" [style.width.%]="g.percentage ?? 0"></span>
                  </div>
                  <div class="goals__metrics">
                    <span class="goals__pct">{{ g.percentage === null ? '—' : g.percentage + '%' }}</span>
                    <span class="goals__amount">{{ amountLabel(g) }}</span>
                    @if (g.forecast) { <span class="goals__forecast goals__forecast--{{ g.forecast }}">{{ forecastLabel(g.forecast) }}</span> }
                  </div>
                  @if (deadlineLabel(g); as dl) { <span class="goals__deadline">{{ dl }}</span> }
                </div>
              </app-card>
            </li>
          } @empty {
            <li class="goals__focus-empty goals__focus-empty--muted">Все активные цели в фокусе</li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .goals {
        padding: var(--space-4) 0;
      }
      .goals__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .goals__head-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: nowrap;
        overflow-x: auto;
        min-width: 0;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .goals__head-actions::-webkit-scrollbar {
        display: none;
      }
      .goals__head-actions .btn {
        flex-shrink: 0;
      }
      .goals__hint {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        margin: 0 0 var(--space-3);
      }
      .goals__badge--example {
        color: var(--color-warning, #b8860b);
        border-color: var(--color-warning, #b8860b);
      }
      .goals__filters {
        display: flex;
        gap: var(--space-2);
        margin: var(--space-3) 0 var(--space-3);
        // На узких экранах чипы не переносим, а крутим горизонтально (+нудж appHscrollHint).
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .goals__filters::-webkit-scrollbar {
        display: none;
      }
      .goals__chip {
        flex-shrink: 0;
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
      .goals__domain-filter {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-4);
        font-size: var(--fs-sm);
      }
      .goals__domain-label {
        color: var(--color-text-muted);
      }
      .goals__domain-select {
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
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
      .goals__section {
        margin: var(--space-4) 0 var(--space-2);
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--color-text);
      }
      .goals__section--muted {
        color: var(--color-text-muted);
        font-weight: 500;
      }
      .goals__focus-zone {
        border: 1.5px dashed var(--color-accent);
        border-radius: var(--radius-md);
        padding: var(--space-2);
        min-height: 52px;
      }
      .goals__focus-zone.cdk-drop-list-receiving,
      .goals__focus-zone.cdk-drop-list-dragging {
        border-style: solid;
        background: var(--color-surface-2);
      }
      .goals__focus-empty {
        list-style: none;
        text-align: center;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
        padding: var(--space-3);
      }
      .goals__focus-empty--muted {
        opacity: 0.7;
      }
      .goals__star {
        margin-left: auto;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: var(--fs-md);
        line-height: 1;
        color: var(--color-text-muted);
        padding: 2px 4px;
        border-radius: var(--radius-sm);
      }
      .goals__star--on {
        color: var(--color-accent);
      }
      .goals__star:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .goals__grip {
        border: none;
        background: transparent;
        cursor: grab;
        color: var(--color-text-muted);
        font-size: var(--fs-md);
        line-height: 1;
        padding: 0 var(--space-1);
        touch-action: none;
      }
      .goals__grip:active {
        cursor: grabbing;
      }
      .cdk-drag-preview {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      }
      .cdk-drag-placeholder {
        opacity: 0.4;
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
        font-weight: 600;
        color: var(--color-text);
        text-decoration: none;
        cursor: pointer;
      }
      .goals__name:hover {
        text-decoration: underline;
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
  private readonly _dialog = inject(MatDialog);
  private readonly _modal = inject(ModalService);

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
  /** Каталог сфер (для фильтра). */
  protected readonly domains = signal<AccentRefItem[]>([]);
  /** Текущий фильтр по сфере ('' = все). */
  protected readonly domainFilter = signal('');
  /** Идёт получение/очистка стартового пака. */
  protected readonly packBusy = signal(false);
  /** Есть ли ещё не присвоенные примеры (для бейджа-хинта и контекстной кнопки). */
  protected readonly hasStarters = computed(() => this.items().some((item) => item.isStarter));
  /** Идёт переключение фокуса. */
  protected readonly focusBusy = signal(false);
  /** Цели «в фокусе» (focus_order != null), по возрастанию ранга (ADR-0053). */
  protected readonly focusedItems = computed(() =>
    this.items()
      .filter((g) => g.focusOrder !== null)
      .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0)),
  );
  /** Остальные цели (не в фокусе) — в исходном порядке. */
  protected readonly unfocusedItems = computed(() =>
    this.items().filter((g) => g.focusOrder === null),
  );

  public constructor() {
    this._api.listDomains().subscribe({ next: (d) => { this.domains.set(d); }, error: () => undefined });
    this._load();
  }

  /** Меняет фильтр по сфере и перезагружает. */
  protected setDomain(value: string): void {
    this.domainFilter.set(value);
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
    if (goal.direction === 'maintain') {
      // Коридор [startValue, targetValue] + последний замер (ADR-0052).
      return `${String(goal.startValue ?? 0)}–${String(goal.targetValue)} ${goal.unit} · сейчас ${current}`;
    }
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

  /** Открывает форму создания цели; на сохранении создаёт и перезагружает. */
  protected openCreate(): void {
    this._openForm({});
  }

  /** Получить стартовый пак целей (докидывает примеры) — список приходит свежим. */
  protected seedPack(): void {
    this.packBusy.set(true);
    this._api.seedGoalStarterPack().subscribe({
      next: (items) => {
        this.items.set(items);
        this.packBusy.set(false);
      },
      error: (err: unknown) => {
        this.packBusy.set(false);
        this._modal.error('Не удалось получить пак', errorMessage(err));
      },
    });
  }

  /** Очистить примеры (только непринятые) — список приходит свежим. */
  protected clearExamples(): void {
    this.packBusy.set(true);
    this._api.clearGoalStarters().subscribe({
      next: (items) => {
        this.items.set(items);
        this.packBusy.set(false);
      },
      error: (err: unknown) => {
        this.packBusy.set(false);
        this._modal.error('Не удалось очистить примеры', errorMessage(err));
      },
    });
  }

  /**
   * Переключает «фокус» цели (ADR-0053): реактивно обновляет список (без F5); при превышении
   * мягкого порога — ненавязчивая подсказка (не блок).
   */
  protected toggleFocus(goal: GoalProgressView): void {
    this.focusBusy.set(true);
    const req =
      goal.focusOrder === null ? this._api.focusGoal(goal.id) : this._api.unfocusGoal(goal.id);
    req.subscribe({
      next: (res) => {
        this.focusBusy.set(false);
        this._load();
        if (res.overLimit) {
          this._modal.message(
            'Многовато в фокусе',
            ModalHeaderClassIcon.Info,
            `Уже ${String(res.focusedCount)} целей в фокусе. Фокус — про единицы: что-то можно отпустить.`,
          );
        }
      },
      error: (err: unknown) => {
        this.focusBusy.set(false);
        this._modal.error('Не удалось изменить фокус', errorMessage(err));
      },
    });
  }

  /**
   * Drop в зону «⭐ В фокусе» (ADR-0053/0054). Внутри фокуса — перестановка ранга (optimistic +
   * reorderFocus). Из «Остальных» — взять в фокус (через focusGoal: mission-filter/лимит; при отказе
   * откат + ошибка), затем выставить порядок фокуса.
   */
  protected dropOnFocus(event: CdkDragDrop<unknown>): void {
    const goal = event.item.data as GoalProgressView;
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) {
        return;
      }
      const focused = [...this.focusedItems()];
      moveItemInArray(focused, event.previousIndex, event.currentIndex);
      const reordered = focused.map((g, i) => ({ ...g, focusOrder: i }));
      this.items.set([...reordered, ...this.unfocusedItems()]);
      this._api.reorderGoalFocus(reordered.map((g) => g.id)).subscribe({
        error: (err: unknown) => {
          this._load();
          this._modal.error('Не удалось сохранить порядок', errorMessage(err));
        },
      });
      return;
    }
    const focusedIds = this.focusedItems().map((g) => g.id);
    focusedIds.splice(event.currentIndex, 0, goal.id);
    this._api.focusGoal(goal.id).subscribe({
      next: (res) => {
        this._api.reorderGoalFocus(focusedIds).subscribe({
          next: () => this._load(),
          error: () => this._load(),
        });
        if (res.overLimit) {
          this._modal.message(
            'Многовато в фокусе',
            ModalHeaderClassIcon.Info,
            `Уже ${String(res.focusedCount)} целей в фокусе. Фокус — про единицы: что-то можно отпустить.`,
          );
        }
      },
      error: (err: unknown) => {
        this._load();
        this._modal.error('Не удалось взять в фокус', errorMessage(err));
      },
    });
  }

  /**
   * Drop в зону «Остальные» (ADR-0054). Внутри — перестановка `position`. Из «В фокусе» — убрать из
   * фокуса (unfocusGoal), затем выставить позицию.
   */
  protected dropOnOthers(event: CdkDragDrop<unknown>): void {
    const goal = event.item.data as GoalProgressView;
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) {
        return;
      }
      const others = [...this.unfocusedItems()];
      moveItemInArray(others, event.previousIndex, event.currentIndex);
      this.items.set([...this.focusedItems(), ...others]);
      this._api
        .reorderGoals([...this.focusedItems().map((g) => g.id), ...others.map((g) => g.id)])
        .subscribe({
          error: (err: unknown) => {
            this._load();
            this._modal.error('Не удалось сохранить порядок', errorMessage(err));
          },
        });
      return;
    }
    const othersIds = this.unfocusedItems().map((g) => g.id);
    othersIds.splice(event.currentIndex, 0, goal.id);
    this._api.unfocusGoal(goal.id).subscribe({
      next: () => {
        const focusedIds = this.focusedItems()
          .filter((g) => g.id !== goal.id)
          .map((g) => g.id);
        this._api.reorderGoals([...focusedIds, ...othersIds]).subscribe({
          next: () => this._load(),
          error: () => this._load(),
        });
      },
      error: (err: unknown) => {
        this._load();
        this._modal.error('Не удалось убрать из фокуса', errorMessage(err));
      },
    });
  }

  /** Открывает форму редактирования цели. */
  protected openEdit(goal: GoalProgressView): void {
    this._openForm({ goal });
  }

  /** Открывает модалку формы и применяет результат (create/update) → reload. */
  private _openForm(data: GoalFormData): void {
    const ref = this._dialog.open<GoalFormModalComponent, GoalFormData, GoalFormResult | null>(
      GoalFormModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush', data },
    );
    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      const request =
        result.mode === 'create'
          ? this._api.createGoal(result.payload)
          : this._api.updateGoal(data.goal!.id, result.payload);
      request.subscribe({
        next: () => { this._load(); },
        error: (err: unknown) => this._modal.error('Не удалось сохранить цель', errorMessage(err)),
      });
    });
  }

  /**
   *
   */
  private _fmt(ymd: string): string {
    const date = new Date(`${ymd}T00:00:00`);
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  }

  /**
   *
   */
  private _load(): void {
    this.loading.set(true);
    const status = this.statusFilter();
    const domain = this.domainFilter();
    this._api
      .listGoals(status === 'all' ? undefined : status, domain === '' ? undefined : domain)
      .subscribe({
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
