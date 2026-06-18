import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { TextFieldComponent } from '../../../shared/ui/text-field/text-field.component';
import { HABIT_KIND_LABELS } from '../accent.types';
import type { HabitKind, HabitPayload, HabitView, LadderPolicy } from '../accent.types';
import {
  WEEKDAY_CODES,
  WEEKDAY_LABELS,
  buildRecurrence,
  parseRecurrence,
} from './recurrence-builder.util';
import type { RecurrenceMode } from './recurrence-builder.util';

/** Данные в модалку: если `habit` задан — режим редактирования. */
export interface HabitFormData {
  /** Редактируемая привычка (или undefined — создание). */
  habit?: HabitView;
}

/**
 * Модалка создания/редактирования привычки (MatDialog, ADR-0026) — ядро (2.4·16a):
 * название/иконка/описание/тип + пикер расписания (RRULE-пресеты) + лесенка
 * (min·current·goal·step·policy; для binary авто 1/1) + minVersion. Сфера/атрибуты — ·16b.
 * Закрывается с `HabitPayload` (сохранить) или `null` (отмена).
 */
@Component({
  selector: 'app-habit-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, TextFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hf">
      <h2 class="hf__title">{{ isEdit ? 'Изменить привычку' : 'Новая привычка' }}</h2>

      <form class="hf__form" [formGroup]="form" (ngSubmit)="save()">
        <app-text-field
          label="Название"
          [control]="titleControl"
          placeholder="Напр. Отжимания"
          [required]="true"
          [error]="titleError()"
        />
        <app-text-field label="Иконка (эмодзи)" [control]="iconControl" placeholder="💪" />
        <app-text-field label="Описание" [control]="descriptionControl" placeholder="Коротко зачем" />

        <label class="hf__field">
          <span class="hf__label">Тип</span>
          <select class="hf__input" formControlName="kind">
            @for (k of kinds; track k.value) {
              <option [ngValue]="k.value">{{ k.label }}</option>
            }
          </select>
        </label>

        <label class="hf__field">
          <span class="hf__label">Повтор</span>
          <select class="hf__input" formControlName="recurrenceMode">
            <option [ngValue]="'daily'">Каждый день</option>
            <option [ngValue]="'weekdays'">По будням (Пн–Пт)</option>
            <option [ngValue]="'custom-week'">По дням недели</option>
            <option [ngValue]="'every-n'">Каждые N дней</option>
          </select>
        </label>

        @if (showCustomWeek()) {
          <div class="hf__weekdays">
            @for (d of weekdayCodes; track d) {
              <button
                type="button"
                class="hf__day"
                [class.active]="weekdays().has(d)"
                (click)="toggleWeekday(d)"
              >
                {{ weekdayLabel(d) }}
              </button>
            }
          </div>
        }
        @if (showInterval()) {
          <label class="hf__field">
            <span class="hf__label">Каждые N дней</span>
            <input class="hf__input" type="number" min="2" formControlName="intervalN" />
          </label>
        }

        @if (isQuantitative()) {
          <div class="hf__ladder">
            <span class="hf__label">Лесенка (план растёт от минимума к цели)</span>
            <div class="hf__row">
              <label class="hf__field">
                <span class="hf__sub">Минимум</span>
                <input class="hf__input" type="number" min="1" formControlName="minTarget" />
              </label>
              <label class="hf__field">
                <span class="hf__sub">Сейчас</span>
                <input class="hf__input" type="number" min="1" formControlName="currentTarget" />
              </label>
              <label class="hf__field">
                <span class="hf__sub">Цель (опц.)</span>
                <input class="hf__input" type="number" min="1" formControlName="goalTarget" />
              </label>
            </div>
            <div class="hf__row">
              <label class="hf__field">
                <span class="hf__sub">Подстройка</span>
                <select class="hf__input" formControlName="policy">
                  <option [ngValue]="'manual'">Вручную</option>
                  <option [ngValue]="'adaptive'">Адаптивно</option>
                </select>
              </label>
              @if (isAdaptive()) {
                <label class="hf__field">
                  <span class="hf__sub">Шаг</span>
                  <input class="hf__input" type="number" min="1" formControlName="step" />
                </label>
              }
            </div>
          </div>
        }

        <app-text-field label="Минимум на плохой день (опц.)" [control]="minVersionControl" />

        @if (formError()) {
          <span class="hf__error">{{ formError() }}</span>
        }

        <div class="hf__actions">
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
          <app-button type="submit">Сохранить</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .hf {
        padding: var(--space-5);
      }
      .hf__title {
        margin: 0 0 var(--space-4);
      }
      .hf__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .hf__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        flex: 1;
      }
      .hf__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hf__sub {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .hf__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
      }
      .hf__input:focus {
        border-color: var(--color-accent);
      }
      .hf__row {
        display: flex;
        gap: var(--space-3);
      }
      .hf__ladder {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-surface-2);
        border-radius: var(--radius-md);
      }
      .hf__weekdays {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .hf__day {
        min-width: 40px;
        min-height: var(--touch-min);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text-muted);
        cursor: pointer;
      }
      .hf__day.active {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }
      .hf__error {
        font-size: var(--fs-sm);
        color: var(--color-danger);
      }
      .hf__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
      }
    `,
  ],
})
export class HabitFormModalComponent {
  private readonly _ref =
    inject<MatDialogRef<HabitFormModalComponent, HabitPayload | null>>(MatDialogRef);
  private readonly _data = inject<HabitFormData>(MAT_DIALOG_DATA);

  /** Режим редактирования. */
  protected readonly isEdit = this._data.habit !== undefined;
  /** Опции типа. */
  protected readonly kinds = (Object.entries(HABIT_KIND_LABELS) as [HabitKind, string][]).map(
    ([value, label]) => ({ value, label }),
  );
  /** Коды дней недели (для пикера). */
  protected readonly weekdayCodes = WEEKDAY_CODES;
  /** Выбранные дни недели (для `custom-week`). */
  protected readonly weekdays = signal<Set<string>>(new Set(['MO', 'WE', 'FR']));
  /** Попытка сохранить (для показа ошибок). */
  protected readonly submitted = signal(false);
  /** Ошибка формы (кросс-поля лесенки). */
  protected readonly formError = signal<string | null>(null);

  /** Реактивная форма. */
  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    icon: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    kind: new FormControl<HabitKind>('binary', { nonNullable: true }),
    recurrenceMode: new FormControl<RecurrenceMode>('daily', { nonNullable: true }),
    intervalN: new FormControl(2, { nonNullable: true }),
    minTarget: new FormControl(1, { nonNullable: true }),
    currentTarget: new FormControl(1, { nonNullable: true }),
    goalTarget: new FormControl<number | null>(null),
    step: new FormControl(1, { nonNullable: true }),
    policy: new FormControl<LadderPolicy>('manual', { nonNullable: true }),
    minVersion: new FormControl('', { nonNullable: true }),
  });

  private readonly _kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  private readonly _mode = toSignal(this.form.controls.recurrenceMode.valueChanges, {
    initialValue: this.form.controls.recurrenceMode.value,
  });
  private readonly _policy = toSignal(this.form.controls.policy.valueChanges, {
    initialValue: this.form.controls.policy.value,
  });

  /** Показывать ли поля лесенки (не binary). */
  protected readonly isQuantitative = computed(() => this._kind() !== 'binary');
  /** Адаптивная ли политика (показ шага). */
  protected readonly isAdaptive = computed(() => this._policy() === 'adaptive');
  /** Показывать ли выбор дней недели. */
  protected readonly showCustomWeek = computed(() => this._mode() === 'custom-week');
  /** Показывать ли интервал. */
  protected readonly showInterval = computed(() => this._mode() === 'every-n');

  public constructor() {
    const habit = this._data.habit;
    if (habit !== undefined) {
      const rec = parseRecurrence(habit.recurrence);
      this.weekdays.set(new Set(rec.weekdays));
      this.form.setValue({
        title: habit.title,
        icon: habit.icon ?? '',
        description: habit.description ?? '',
        kind: habit.kind,
        recurrenceMode: rec.mode,
        intervalN: rec.intervalN,
        minTarget: habit.ladder.minTarget,
        currentTarget: habit.ladder.currentTarget,
        goalTarget: habit.ladder.goalTarget,
        step: habit.ladder.step ?? 1,
        policy: habit.ladder.policy,
        minVersion: habit.minVersion ?? '',
      });
    }
  }

  /** Контрол названия. */
  protected get titleControl(): FormControl<string> {
    return this.form.controls.title;
  }
  /** Контрол иконки. */
  protected get iconControl(): FormControl<string> {
    return this.form.controls.icon;
  }
  /** Контрол описания. */
  protected get descriptionControl(): FormControl<string> {
    return this.form.controls.description;
  }
  /** Контрол «минимум на плохой день». */
  protected get minVersionControl(): FormControl<string> {
    return this.form.controls.minVersion;
  }

  /** RU-подпись дня недели. */
  protected weekdayLabel(code: string): string {
    return WEEKDAY_LABELS[code] ?? code;
  }

  /** Ошибка названия. */
  protected titleError(): string | null {
    const c = this.form.controls.title;
    if ((!c.touched && !this.submitted()) || c.valid) {
      return null;
    }
    return c.errors?.['maxlength'] ? 'Название: максимум 120.' : 'Название обязательно.';
  }

  /** Переключает день недели. */
  protected toggleWeekday(code: string): void {
    this.weekdays.update((set) => {
      const next = new Set(set);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  /** Сохраняет — собирает payload (recurrence + ladder), закрывает диалог. */
  protected save(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const ladder =
      v.kind === 'binary'
        ? { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual' as const }
        : {
            minTarget: v.minTarget,
            currentTarget: v.currentTarget,
            goalTarget: v.goalTarget,
            step: v.policy === 'adaptive' ? v.step : null,
            policy: v.policy,
          };
    if (ladder.currentTarget < ladder.minTarget) {
      this.formError.set('«Сейчас» не может быть меньше минимума.');
      return;
    }
    if (ladder.goalTarget !== null && ladder.goalTarget < ladder.currentTarget) {
      this.formError.set('«Цель» не может быть меньше «Сейчас».');
      return;
    }
    const recurrence = buildRecurrence({
      mode: v.recurrenceMode,
      weekdays: [...this.weekdays()],
      intervalN: v.intervalN,
    });
    const payload: HabitPayload = {
      title: v.title.trim(),
      kind: v.kind,
      recurrence,
      ladder,
      description: v.description.trim() === '' ? null : v.description.trim(),
      icon: v.icon.trim() === '' ? null : v.icon.trim(),
      minVersion: v.minVersion.trim() === '' ? null : v.minVersion.trim(),
    };
    this._ref.close(payload);
  }

  /** Отмена — закрывает без результата. */
  protected cancel(): void {
    this._ref.close(null);
  }
}
