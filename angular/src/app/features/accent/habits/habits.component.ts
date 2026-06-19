import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, HscrollHintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hb">
      <header class="hb__head">
        <h2>Привычки</h2>
        <div class="hb__head-actions" appHscrollHint [appHscrollHintDelay]="1300">
          @if (tab() === 'templates' && habits().length > 0) {
            @if (hasStarters()) {
              <app-button variant="ghost" [loading]="packBusy()" (click)="clearExamples()">
                Очистить примеры
              </app-button>
            } @else {
              <app-button variant="ghost" [loading]="packBusy()" (click)="seedPack()">
                Получить пак
              </app-button>
            }
          }
          <app-button (click)="openCreate()">Добавить</app-button>
        </div>
      </header>

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
            text="Заведи привычку во вкладке «Шаблоны» — задачи появятся по её расписанию."
          />
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
                      <strong class="hb__name" [class.hb__done]="t.status === 'done'">{{ t.title }}</strong>
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
            <app-button [loading]="packBusy()" (click)="seedPack()">Получить стартовый пак</app-button>
            <app-button variant="ghost" (click)="openCreate()">Создать свою</app-button>
          </app-empty-state>
        } @else {
          @if (hasStarters()) {
            <p class="hb__hint">«Добавить себе» или «Изм.» оставит привычку себе — и она начнёт давать задачи.</p>
          }
          <ul class="hb__list">
            @for (h of habits(); track h.id) {
              <li>
                <app-card>
                  <div class="hb__item">
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
                      <app-button variant="ghost" (click)="openEdit(h)">Изм.</app-button>
                      <app-button variant="danger" [loading]="busyId() === h.id" (click)="deactivate(h)">
                        Убрать
                      </app-button>
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
        padding: var(--space-5);
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
  protected readonly tab = signal<'today' | 'templates'>('templates');
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
  /** Таймер авто-скрытия баннера. */
  private _flashTimer: ReturnType<typeof setTimeout> | null = null;

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
  }

  /** Переключает вкладку; при «Сегодня» — (пере)загружает задачи (материализация на бэке). */
  protected selectTab(tab: 'today' | 'templates'): void {
    this.tab.set(tab);
    if (tab === 'today') {
      this._loadTasks();
    }
  }

  /** Метаданные задачи (тип + цель/сделано). */
  protected taskMeta(task: TaskView): string {
    const kind = HABIT_KIND_LABELS[task.kind];
    if (task.targetValue === null) {
      return kind;
    }
    const done = task.doneValue === null ? '' : `${String(task.doneValue)}/`;
    return `${kind} · ${done}${String(task.targetValue)}`;
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
        this._flashLadder(result.ladderEvent);
        this.busyTaskId.set(null);
      },
      error: () => this.busyTaskId.set(null),
    });
  }

  /** Показывает баннер-фидбэк движения лесенки (авто-скрытие ~7с). null — ничего. */
  private _flashLadder(event: LadderEventView): void {
    if (event === null) {
      return;
    }
    const text =
      event === 'raised'
        ? '🎉 Планка выросла — стало чуть сложнее. Ты справляешься!'
        : '🌙 Сегодня планка мягче — это нормально, серия цела.';
    this.ladderFlash.set({ event, text });
    if (this._flashTimer !== null) {
      clearTimeout(this._flashTimer);
    }
    this._flashTimer = setTimeout(() => this.ladderFlash.set(null), 7000);
  }

  /** Закрывает баннер-фидбэк вручную. */
  protected dismissFlash(): void {
    if (this._flashTimer !== null) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
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
      { width: MODAL_MEDIUM_WIDTH, panelClass: 'modal-flush', data },
    );
    ref.afterClosed().subscribe((payload) => {
      if (payload) {
        submit(payload).subscribe({ next: () => this._load(), error: () => undefined });
      }
    });
  }

  /** Деактивирует привычку после подтверждения (мягко: исчезает из активных). */
  protected deactivate(habit: HabitView): void {
    void this._modal
      .confirm({
        title: 'Убрать привычку?',
        text: `«${habit.title}» перестанет появляться в задачах дня. История останется.`,
        confirmText: 'Убрать',
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
          error: () => this.busyId.set(null),
        });
      });
  }
}
