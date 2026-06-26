import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { HscrollHintDirective } from '../../../shared/ui/hscroll-hint.directive';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_MEDIUM_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { HABIT_KIND_LABELS } from '../accent.types';
import type { HabitPayload, HabitView, LadderEventView, TaskView } from '../accent.types';
import { recurrenceLabel } from './recurrence-label.util';
import { HabitFormModalComponent } from './habit-form-modal.component';
import type { HabitFormData } from './habit-form-modal.component';

/**
 * Экран привычек (`/accent/habits`, 2.4) — вкладки **Сегодня** (дневной чеклист, ·17) и
 * **Шаблоны** (управление привычками: список + деактивация, ·15; CRUD-модалка — ·16).
 * Тонкий слой над `AccentApiService`. Signals, OnPush, чистый SCSS.
 */
@Component({
  selector: 'app-habits',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    HscrollHintDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hb">
      <header class="hb__head">
        <h2>Привычки</h2>
        <div class="hb__head-actions" appHscrollHint [appHscrollHintDelay]="1300">
          @if (tab() === 'templates' && habits().length > 0) {
            @if (hasStarters()) {
              <app-button variant="ghost" [loading]="packBusy()" (click)="clearExamples()">
                <span aria-hidden="true">🧹</span>
                Очистить примеры
              </app-button>
            } @else {
              <app-button variant="ghost" [loading]="packBusy()" (click)="seedPack()">
                <span aria-hidden="true">🎁</span>
                Получить пак
              </app-button>
            }
          }
          <span class="tooltip-host" [attr.data-tooltip]="'Добавить привычку'">
            <app-button ariaLabel="Добавить привычку" (click)="openCreate()">+</app-button>
          </span>
        </div>
      </header>

      <aside class="hb__why">
        <span class="hb__why-icon" aria-hidden="true">🪜</span>
        <p class="hb__why-text">
          <strong>Не идеально, а постоянно.</strong> Маленькие регулярные шаги; лесенка бережёт от
          выгорания — в трудный день делаешь минимум, и серия цела.
        </p>
      </aside>

      <nav class="hb__tabs">
        <button type="button" [class.active]="tab() === 'today'" (click)="selectTab('today')">Сегодня</button>
        <button type="button" [class.active]="tab() === 'templates'" (click)="selectTab('templates')">Шаблоны</button>
      </nav>

      @if (tab() === 'today') {
        @if (ladderFlash(); as flash) {
          <div class="hb__flash" [attr.data-event]="flash.event" role="status">
            <span>{{ flash.text }}</span>
            <button type="button" class="hb__flash-x" (click)="dismissFlash()" aria-label="Закрыть">×</button>
          </div>
        }
        @if (tasksLoading()) {
          <p class="hb__muted">Загрузка…</p>
        } @else if (tasksError()) {
          <p class="hb__error">{{ tasksError() }}</p>
        } @else if (tasks().length === 0) {
          <app-empty-state
            title="На сегодня задач нет"
            text="Создай привычку в «Шаблонах» — и задачи появятся здесь по её расписанию."
          />
          <div class="hb__empty-cta">
            <app-button (click)="selectTab('templates')">Перейти в шаблоны</app-button>
          </div>
        } @else {
          <div class="hb__progress">
            <span>Сегодня сделано: <b>{{ donePercent() }}%</b></span>
            <span class="hb__streak">🔥 серия — скоро</span>
          </div>
          <ul class="hb__list">
            @for (t of tasks(); track t.id) {
              <li>
                <app-card>
                  <div class="hb__item">
                    <div class="hb__main">
                      <span class="hb__name-row">
                        <strong class="hb__name" [class.hb__done]="t.status === 'done'">{{ t.title }}</strong>
                        @if (t.carriedFromPostpone) {
                          <span class="hb__carried" title="Перенесена с прошлого дня">⤴ со вчера</span>
                        }
                      </span>
                      <span class="hb__meta">{{ taskMeta(t) }}</span>
                    </div>
                    <div class="hb__actions">
                      <span class="hb__badge" [attr.data-status]="t.status">{{ statusLabel(t) }}</span>
                      @if (t.status === 'pending' || t.status === 'partial') {
                        @if (t.kind === 'binary') {
                          <app-button [loading]="busyTaskId() === t.id" (click)="completeTask(t)">Сделал</app-button>
                        } @else {
                          <input #val class="hb__numin" type="number" min="0" [value]="t.targetValue ?? 1" />
                          <app-button [loading]="busyTaskId() === t.id" (click)="completeTask(t, val.value)">Отметить</app-button>
                        }
                      }
                      @if (t.status === 'done' || t.status === 'partial') {
                        <app-button variant="ghost" (click)="uncompleteTask(t)">Отменить</app-button>
                      }
                      @if (t.status === 'pending') {
                        <app-button variant="ghost" (click)="postpone(t)">→ Завтра</app-button>
                      }
                    </div>
                  </div>
                </app-card>
              </li>
            }
          </ul>
        }
      } @else {
        @if (loading()) {
          <p class="hb__muted">Загрузка…</p>
        } @else if (error()) {
          <p class="hb__error">{{ error() }}</p>
        } @else if (habits().length === 0) {
          <app-empty-state
            title="Пока нет привычек"
            text="Начни с готового набора — примеры с мягкой планкой, по силам даже в плохой день. Или заведи свою."
          >
            <app-button [loading]="packBusy()" (click)="seedPack()">
              <span aria-hidden="true">🎁</span>
              Получить стартовый пак
            </app-button>
            <app-button variant="ghost" (click)="openCreate()">Создать свою</app-button>
          </app-empty-state>
        } @else {
          @if (hasStarters()) {
            <p class="hb__hint">«Добавить себе» или «⋯» → ✏️ Изменить оставит привычку себе — и она начнёт давать задачи.</p>
          }
          <ul class="hb__list" cdkDropList (cdkDropListDropped)="dropHabit($event)">
            @for (h of habits(); track h.id) {
              <li cdkDrag>
                <app-card>
                  <div class="hb__item">
                    <button type="button" class="hb__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                    <div class="hb__main">
                      <span class="hb__name-row">
                        <strong class="hb__name">{{ h.icon ? h.icon + ' ' : '' }}{{ h.title }}</strong>
                        @if (h.isStarter) {
                          <span class="hb__example">пример</span>
                        }
                      </span>
                      <span class="hb__meta">
                        {{ kindLabel(h.kind) }} · {{ recurrenceText(h.recurrence) }} · {{ ladderText(h) }}
                      </span>
                      @if (h.description) {
                        <span class="hb__desc">{{ h.description }}</span>
                      }
                    </div>
                    <div class="hb__actions">
                      @if (h.isStarter) {
                        <app-button [loading]="busyId() === h.id" (click)="adoptHabit(h)">Добавить себе</app-button>
                      }
                      <div class="hb__menu-wrap">
                        <span class="tooltip-host" [attr.data-tooltip]="'Дополнительные опции'">
                          <button
                            type="button"
                            class="hb__menu-btn"
                            aria-label="Дополнительные опции"
                            (click)="toggleMenu(h.id, $event)"
                          >⋯</button>
                        </span>
                        @if (openMenuId() === h.id) {
                          <div class="hb__menu" (click)="$event.stopPropagation()">
                            <button type="button" class="hb__menu-item" (click)="openEdit(h); closeMenu()">
                              <span class="hb__menu-ico" aria-hidden="true">✏️</span>
                              Изменить
                            </button>
                            <button
                              type="button"
                              class="hb__menu-item hb__menu-item--danger"
                              (click)="deactivate(h); closeMenu()"
                            >
                              <span class="hb__menu-ico" aria-hidden="true">🗑️</span>
                              Удалить
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </app-card>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [
    `
      .hb {
        padding: var(--space-4) 0;
      }
      .hb__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .hb__actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        // Держим блок действий у правого края даже при переносе на свою строку —
        // иначе «⋯» уезжает влево и меню (right:0) раскрывается за край экрана.
        margin-left: auto;
      }
      .hb__head-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: nowrap;
        overflow-x: auto;
        min-width: 0;
        scroll-behavior: smooth;
        // Полоса скрыта во всех браузерах (крутим пальцем/нуджем — appHscrollHint).
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .hb__head-actions::-webkit-scrollbar {
        display: none;
      }
      .hb__head-actions .btn {
        flex-shrink: 0;
      }
      .hb__hint {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        margin: 0 0 var(--space-3);
      }
      .hb__name-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .hb__example {
        font-size: var(--fs-xs);
        color: var(--color-accent);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-2);
      }
      .hb__carried {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
        background: var(--color-surface-2);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-2);
        white-space: nowrap;
      }
      .hb__menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .hb__menu-btn {
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
      .hb__menu-btn:hover {
        color: var(--color-text);
        border-color: var(--color-text-muted);
      }
      .hb__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        min-width: 160px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-1);
        overflow: hidden;
      }
      .hb__menu-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        text-align: left;
        padding: var(--space-2) var(--space-3);
        min-height: var(--touch-min);
        background: none;
        border: none;
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .hb__menu-item:hover {
        background: var(--color-surface-2);
      }
      .hb__menu-item--danger {
        color: var(--color-danger);
      }
      .hb__menu-ico {
        width: 1.2em;
        text-align: center;
        flex-shrink: 0;
      }
      .hb__tabs {
        display: flex;
        gap: var(--space-3);
        margin: var(--space-3) 0 var(--space-4);
        border-bottom: 1px solid var(--color-border);
      }
      .hb__tabs button {
        padding: var(--space-2) var(--space-1);
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--color-text-muted);
        cursor: pointer;
      }
      .hb__tabs button.active {
        color: var(--color-text);
        border-bottom-color: var(--color-accent);
      }
      .hb__muted {
        color: var(--color-text-muted);
      }
      .hb__why {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        margin: var(--space-3) 0 0;
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-2);
        border-left: 3px solid var(--color-accent);
        border-radius: var(--radius-md);
      }
      .hb__why-icon {
        font-size: var(--fs-lg);
        line-height: 1.3;
      }
      .hb__why-text {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hb__why-text strong {
        color: var(--color-text);
      }
      .hb__empty-cta {
        display: flex;
        justify-content: center;
        margin-top: var(--space-4);
      }
      .hb__flash {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font-size: var(--fs-sm);
      }
      .hb__flash[data-event='raised'] {
        border-color: var(--color-accent);
      }
      .hb__flash-x {
        flex-shrink: 0;
        width: var(--touch-min);
        min-height: var(--touch-min);
        background: none;
        border: none;
        color: var(--color-text-muted);
        font-size: var(--fs-lg);
        line-height: 1;
        cursor: pointer;
      }
      .hb__progress {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
        color: var(--color-text-muted);
        flex-wrap: wrap;
      }
      .hb__streak {
        font-size: var(--fs-sm);
      }
      .hb__done {
        text-decoration: line-through;
        opacity: 0.7;
      }
      .hb__badge {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        white-space: nowrap;
      }
      .hb__badge[data-status='done'] {
        color: var(--color-accent);
        font-weight: 600;
      }
      .hb__numin {
        width: 64px;
        min-height: var(--touch-min);
        padding: 0 var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
      }
      .hb__error {
        color: var(--color-danger);
      }
      .hb__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .hb__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .hb__grip {
        border: none;
        background: transparent;
        cursor: grab;
        color: var(--color-text-muted);
        font-size: var(--fs-md);
        line-height: 1;
        padding: 0 var(--space-1);
        touch-action: none;
      }
      .hb__grip:active {
        cursor: grabbing;
      }
      .cdk-drag-preview {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      }
      .cdk-drag-placeholder {
        opacity: 0.4;
      }
      .hb__main {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }
      .hb__name {
        font-size: var(--fs-md);
      }
      .hb__meta {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hb__desc {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        font-style: italic;
      }
    `,
  ],
})
export class HabitsComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _modal = inject(ModalService);
  private readonly _dialog = inject(MatDialog);

  /** Активная вкладка. */
  protected readonly tab = signal<'today' | 'templates'>('today');
  /** Список привычек. */
  protected readonly habits = signal<HabitView[]>([]);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки (или null). */
  protected readonly error = signal<string | null>(null);
  /** Id привычки в процессе деактивации/присвоения. */
  protected readonly busyId = signal<string | null>(null);
  /** Идёт получение/очистка стартового пака. */
  protected readonly packBusy = signal(false);
  /** Есть ли непринятые примеры (для хинта и контекстной кнопки). */
  protected readonly hasStarters = computed(() => this.habits().some((h) => h.isStarter));
  /** Id карточки с открытым меню «⋯» (Изменить/Удалить) или null. */
  protected readonly openMenuId = signal<string | null>(null);

  /** Переключает меню «⋯» карточки; stopPropagation — чтобы document-клик не закрыл сразу. */
  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((cur) => (cur === id ? null : id));
  }

  /** Закрывает меню «⋯». */
  protected closeMenu(): void {
    this.openMenuId.set(null);
  }

  /** Клик где угодно вне меню — закрыть. */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
    }
  }

  /** Escape — закрыть открытое меню. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.openMenuId.set(null);
  }
  /** Задачи дня (вкладка «Сегодня»). */
  protected readonly tasks = signal<TaskView[]>([]);
  /** Идёт загрузка задач дня. */
  protected readonly tasksLoading = signal(false);
  /** Ошибка загрузки задач (или null). */
  protected readonly tasksError = signal<string | null>(null);
  /** Id задачи в процессе отметки (для спиннера). */
  protected readonly busyTaskId = signal<string | null>(null);
  /** Фидбэк движения лесенки (баннер «планка выросла / мягче») или null. */
  protected readonly ladderFlash = signal<{ event: 'raised' | 'lowered'; text: string } | null>(null);

  /** % дня: задачи с прогрессом (done/partial) от всех непропущенных. */
  protected readonly donePercent = computed(() => {
    const active = this.tasks().filter((t) => t.status !== 'skipped');
    if (active.length === 0) {
      return 0;
    }
    const done = active.filter((t) => t.status === 'done' || t.status === 'partial').length;
    return Math.round((done / active.length) * 100);
  });

  public constructor() {
    this._load();
    // Дефолтная вкладка — «Сегодня»: грузим задачи сразу на старте (а не только по клику
    // на вкладку). Иначе при заходе/обновлении страницы прямо на «Сегодня» список пуст,
    // пока не переключишь вкладки (H#B2-4).
    if (this.tab() === 'today') {
      this._loadTasks();
    }
  }

  /** Переключает вкладку; при «Сегодня» — (пере)загружает задачи (материализация на бэке). */
  protected selectTab(tab: 'today' | 'templates'): void {
    this.tab.set(tab);
    if (tab === 'today') {
      this._loadTasks();
    }
  }

  /** Метаданные задачи (тип + явные «надо/сделано» — без неявной дроби). */
  protected taskMeta(task: TaskView): string {
    const kind = HABIT_KIND_LABELS[task.kind];
    if (task.targetValue === null) {
      return kind; // бинарная — без чисел
    }
    const need = `надо: ${String(task.targetValue)}`;
    if (task.doneValue === null) {
      return `${kind} · ${need}`; // ещё не выполнена
    }
    return `${kind} · ${need}, сделано: ${String(task.doneValue)}`;
  }

  /** Подпись статуса задачи. */
  protected statusLabel(task: TaskView): string {
    switch (task.status) {
      case 'done':
        return '✓ Сделано';
      case 'partial':
        return `Частично ${String(task.doneValue ?? 0)}`;
      case 'skipped':
        return task.skipReason === 'postponed' ? 'Перенесено' : 'Пропущено';
      case 'pending':
        return 'Ожидает';
    }
  }

  /** Отмечает выполнение задачи (binary — без значения; иначе — введённое). Двигает лесенку на бэке. */
  protected completeTask(task: TaskView, rawValue?: string): void {
    const doneValue =
      task.kind === 'binary' || rawValue === undefined || rawValue.trim() === ''
        ? undefined
        : Number(rawValue);
    if (doneValue !== undefined && (!Number.isFinite(doneValue) || doneValue < 0)) {
      return;
    }
    this.busyTaskId.set(task.id);
    this._api.completeTask(task.id, doneValue).subscribe({
      next: (result) => {
        this._patchTask(result.task);
        this._flashLadder(result.ladderEvent, task);
        this.busyTaskId.set(null);
      },
      error: () => this.busyTaskId.set(null),
    });
  }

  /**
   * Показывает баннер-фидбэк движения лесенки. Текст — конкретный: какая привычка и
   * было→стало (с «сек» для timed). НЕ авто-скрывается — пользователь закрывает сам
   * (крестик), чтобы успеть прочитать похвалу. null — ничего.
   */
  private _flashLadder(event: LadderEventView, task: TaskView): void {
    if (event === null) {
      return;
    }
    const unit = task.kind === 'timed' ? ' сек' : '';
    const change = `${String(event.prevTarget)}${unit} → ${String(event.newTarget)}${unit}`;
    const text =
      event.direction === 'raised'
        ? `🎉 «${task.title}»: планка выросла, ${change} — стало чуть сложнее. Ты справляешься!`
        : `🌙 «${task.title}»: планка мягче, ${change} — это нормально, серия цела.`;
    this.ladderFlash.set({ event: event.direction, text });
  }

  /** Закрывает баннер-фидбэк вручную. */
  protected dismissFlash(): void {
    this.ladderFlash.set(null);
  }

  /** Снимает отметку выполнения. */
  protected uncompleteTask(task: TaskView): void {
    this.busyTaskId.set(task.id);
    this._api.uncompleteTask(task.id).subscribe({
      next: (updated) => {
        this._patchTask(updated);
        this.busyTaskId.set(null);
      },
      error: () => this.busyTaskId.set(null),
    });
  }

  /** Переносит задачу на завтра (текущая → перенесена; список дня обновляем). */
  protected postpone(task: TaskView): void {
    this.busyTaskId.set(task.id);
    this._api.postponeTask(task.id).subscribe({
      next: () => {
        this.busyTaskId.set(null);
        this._loadTasks();
      },
      error: () => this.busyTaskId.set(null),
    });
  }

  /** Заменяет задачу в списке дня обновлённой версией. */
  private _patchTask(updated: TaskView): void {
    this.tasks.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }

  private _loadTasks(): void {
    this.tasksLoading.set(true);
    this._api.listTasks().subscribe({
      next: (items) => {
        this.tasks.set(items);
        this.tasksError.set(null);
        this.tasksLoading.set(false);
      },
      error: (err: unknown) => {
        this.tasksError.set(errorMessage(err));
        this.tasksLoading.set(false);
      },
    });
  }

  /** RU-подпись типа привычки. */
  protected kindLabel(kind: HabitView['kind']): string {
    return HABIT_KIND_LABELS[kind];
  }

  /** Человекочитаемое расписание (RRULE). */
  protected recurrenceText(recurrence: string): string {
    return recurrenceLabel(recurrence);
  }

  /** Сводка лесенки: текущая цель (→ потолок). */
  protected ladderText(habit: HabitView): string {
    const { currentTarget, goalTarget } = habit.ladder;
    return goalTarget === null ? `цель ${String(currentTarget)}` : `${String(currentTarget)} → ${String(goalTarget)}`;
  }

  private _load(): void {
    this.loading.set(true);
    this._api.listHabits().subscribe({
      next: (items) => {
        this.habits.set(items);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Drag-reorder привычек (ADR-0054, → priority): оптимистично + reorderHabits; откат при ошибке. */
  protected dropHabit(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.habits()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.habits.set(next);
    this._api.reorderHabits(next.map((h) => h.id)).subscribe({
      error: (err: unknown) => {
        this._load();
        this._modal.error('Не удалось сохранить порядок', errorMessage(err));
      },
    });
  }

  /** Получить стартовый пак привычек (докидывает примеры) — список приходит свежим. */
  protected seedPack(): void {
    this.packBusy.set(true);
    this._api.seedHabitStarterPack().subscribe({
      next: (items) => {
        this.habits.set(items);
        this.packBusy.set(false);
      },
      error: () => this.packBusy.set(false),
    });
  }

  /** Очистить примеры (только непринятые стартовые) — список приходит свежим. */
  protected clearExamples(): void {
    this.packBusy.set(true);
    this._api.clearHabitStarters().subscribe({
      next: (items) => {
        this.habits.set(items);
        this.packBusy.set(false);
      },
      error: () => this.packBusy.set(false),
    });
  }

  /** Присвоить пример себе («Добавить себе»): снимает флаг → начнёт давать задачи. */
  protected adoptHabit(habit: HabitView): void {
    this.busyId.set(habit.id);
    this._api.adoptHabit(habit.id).subscribe({
      next: (updated) => {
        this.habits.update((list) => list.map((h) => (h.id === updated.id ? updated : h)));
        this.busyId.set(null);
      },
      error: () => this.busyId.set(null),
    });
  }

  /** Открывает модалку создания привычки. */
  protected openCreate(): void {
    this._openForm({}, (payload) => this._api.createHabit(payload));
  }

  /** Открывает модалку редактирования привычки. */
  protected openEdit(habit: HabitView): void {
    this._openForm({ habit }, (payload) => this._api.updateHabit(habit.id, payload));
  }

  /**
   * Открывает форму привычки и применяет результат через переданный API-вызов.
   * @param data Данные модалки (привычка для редактирования или пусто).
   * @param submit Функция сохранения по payload.
   */
  private _openForm(
    data: HabitFormData,
    submit: (payload: HabitPayload) => ReturnType<AccentApiService['createHabit']>,
  ): void {
    const ref = this._dialog.open<HabitFormModalComponent, HabitFormData, HabitPayload | null>(
      HabitFormModalComponent,
      { width: MODAL_MEDIUM_WIDTH, panelClass: 'modal-flush', data: { ...data, submit } },
    );
    // Сохранение делает САМА форма (закрывается лишь при успехе) → здесь только перезагрузка
    // списка. Ошибка показывается внутри формы, ввод не теряется (H#B2-9).
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this._load();
      }
    });
  }

  /** Удаляет привычку после подтверждения (мягко: деактивация — исчезает из активных). */
  protected deactivate(habit: HabitView): void {
    void this._modal
      .confirm({
        title: 'Удалить привычку?',
        text: `«${habit.title}» перестанет появляться в задачах дня. История останется.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .then((ok) => {
        if (!ok) {
          return;
        }
        this.busyId.set(habit.id);
        this._api.deactivateHabit(habit.id).subscribe({
          next: () => {
            this.habits.update((list) => list.filter((h) => h.id !== habit.id));
            this.busyId.set(null);
          },
          error: (err: unknown) => {
            this.busyId.set(null);
            this._modal.error('Не удалось удалить', errorMessage(err));
          },
        });
      });
  }
}
