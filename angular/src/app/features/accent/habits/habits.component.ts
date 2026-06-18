import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_MEDIUM_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { HABIT_KIND_LABELS } from '../accent.types';
import type { HabitPayload, HabitView } from '../accent.types';
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
  imports: [ButtonComponent, CardComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hb">
      <header class="hb__head">
        <h2>Привычки</h2>
        <app-button (click)="openCreate()">Добавить</app-button>
      </header>

      <nav class="hb__tabs">
        <button type="button" [class.active]="tab() === 'today'" (click)="tab.set('today')">Сегодня</button>
        <button type="button" [class.active]="tab() === 'templates'" (click)="tab.set('templates')">Шаблоны</button>
      </nav>

      @if (tab() === 'today') {
        <p class="hb__muted">Дневной чеклист появится здесь (следующий шаг).</p>
      } @else {
        @if (loading()) {
          <p class="hb__muted">Загрузка…</p>
        } @else if (error()) {
          <p class="hb__error">{{ error() }}</p>
        } @else if (habits().length === 0) {
          <app-empty-state
            title="Пока нет привычек"
            text="Заведи повторяющееся дело с адаптивной планкой — она будет расти от минимума к цели."
          >
            <app-button (click)="openCreate()">Добавить привычку</app-button>
          </app-empty-state>
        } @else {
          <ul class="hb__list">
            @for (h of habits(); track h.id) {
              <li>
                <app-card>
                  <div class="hb__item">
                    <div class="hb__main">
                      <strong class="hb__name">{{ h.icon ? h.icon + ' ' : '' }}{{ h.title }}</strong>
                      <span class="hb__meta">
                        {{ kindLabel(h.kind) }} · {{ recurrenceText(h.recurrence) }} · {{ ladderText(h) }}
                      </span>
                      @if (h.description) {
                        <span class="hb__desc">{{ h.description }}</span>
                      }
                    </div>
                    <div class="hb__actions">
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
  /** Id привычки в процессе деактивации. */
  protected readonly busyId = signal<string | null>(null);

  public constructor() {
    this._load();
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
      { width: MODAL_MEDIUM_WIDTH, data },
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
