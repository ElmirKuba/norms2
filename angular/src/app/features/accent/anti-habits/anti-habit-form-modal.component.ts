import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { NumberFieldComponent } from '../../../shared/ui/number-field/number-field.component';
import { errorMessage } from '../../../core/http/error-message.util';
import type { AntiHabitPayload, AntiHabitView } from '../accent.types';

/** Данные в модалку: если `antiHabit` задан — режим редактирования (префилл). */
export interface AntiHabitFormData {
  /** Редактируемая анти-привычка (или undefined — создание). */
  antiHabit?: AntiHabitView;
  /**
   * Сохранение: форма САМА зовёт API и закрывается лишь при успехе; при ошибке остаётся
   * открытой с текстом ошибки — ввод не теряется (H#B2-9).
   */
  submit?: (payload: AntiHabitPayload) => Observable<unknown>;
}

/**
 * Модалка создания/редактирования «держусь» (MatDialog, ADR-0026). Поля: название (что не
 * делаю), необязательное описание и необязательная цель серии в днях. Валидаторы — зеркало
 * бэка (title 1..160, targetDays целое >0). Свободные поля → подсказка «без ПДн» (ui-ux §9).
 * Закрывается с `AntiHabitPayload` (успех) или `null` (отмена).
 */
@Component({
  selector: 'app-anti-habit-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, NumberFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>{{ isEdit ? 'Изменить «держусь»' : 'Новое «держусь»' }}</h2>
      </div>

      <form class="dlg__form" [formGroup]="form" (ngSubmit)="save()">
        <div class="dlg__body ahf__form">
          <label class="ahf__field">
            <span class="ahf__label">Название <span class="ahf__req">*</span></span>
            <input
              class="ahf__input"
              type="text"
              maxlength="160"
              formControlName="title"
              placeholder="Напр. Не курю"
            />
            @if (titleError()) {
              <span class="ahf__error">{{ titleError() }}</span>
            }
          </label>

          <label class="ahf__field">
            <span class="ahf__label">Описание <span class="ahf__opt">(необязательно)</span></span>
            <textarea
              class="ahf__input ahf__area"
              rows="2"
              maxlength="2000"
              formControlName="description"
              placeholder="Зачем держусь, что помогает"
            ></textarea>
            <span class="ahf__hint">Без реальных имён, телефонов и адресов.</span>
          </label>

          <div class="ahf__field">
            <span class="ahf__check">
              <label class="ahf__check-lbl">
                <input type="checkbox" [checked]="hasTarget()" (change)="toggleTarget()" />
                Задать цель серии (дней)
              </label>
            </span>
            @if (hasTarget()) {
              <app-number-field formControlName="targetDays" [min]="1" [max]="100000" label="Цель, дней" />
              <span class="ahf__hint">Кольцо на экране будет заполняться к этой отметке.</span>
            }
          </div>

          @if (!isEdit) {
            <div class="ahf__field">
              <span class="ahf__check">
                <label class="ahf__check-lbl">
                  <input type="checkbox" [checked]="startInFuture()" (change)="toggleStart()" />
                  Начать не сегодня
                </label>
              </span>
              @if (startInFuture()) {
                <input class="ahf__input" type="date" [min]="minStartDate" formControlName="startDate" />
                <span class="ahf__hint">Серия начнётся с этой даты (планирование). До неё — статус «запланировано».</span>
                @if (startError()) {
                  <span class="ahf__error">{{ startError() }}</span>
                }
              }
            </div>
          }
        </div>

        @if (formError(); as fe) {
          <span class="ahf__error">{{ fe }}</span>
        }
        <div class="dlg__foot">
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
          <app-button type="submit" [disabled]="form.invalid" [loading]="busy()">Сохранить</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .ahf__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .ahf__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .ahf__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ahf__req {
        color: var(--color-danger);
      }
      .ahf__opt {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }
      .ahf__check {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .ahf__check-lbl {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--fs-sm);
        color: var(--color-text);
        cursor: pointer;
      }
      .ahf__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
      }
      .ahf__area {
        resize: vertical;
        min-height: 3rem;
      }
      .ahf__input:focus {
        border-color: var(--color-accent);
      }
      .ahf__error {
        font-size: var(--fs-xs);
        color: var(--color-danger);
      }
      .ahf__hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AntiHabitFormModalComponent {
  private readonly _ref =
    inject<MatDialogRef<AntiHabitFormModalComponent, AntiHabitPayload | null>>(MatDialogRef);
  private readonly _data = inject<AntiHabitFormData>(MAT_DIALOG_DATA);

  /** Режим редактирования (иначе создание). */
  protected readonly isEdit = this._data.antiHabit !== undefined;

  /** Реактивная форма (валидаторы — зеркало бэка). */
  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    description: new FormControl('', { nonNullable: true }),
    targetDays: new FormControl<number>(30, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(100000)],
    }),
    startDate: new FormControl('', { nonNullable: true }),
  });

  /** Задана ли цель серии (UI-галочка) — выкл → `targetDays = null`. */
  protected readonly hasTarget = signal(false);
  /** Плановый старт в будущем (UI-галочка, только при создании). */
  protected readonly startInFuture = signal(false);
  /** Минимум даты старта — завтра (YYYY-MM-DD). */
  protected readonly minStartDate = this._toYmd(new Date(Date.now() + 86_400_000));
  /** Триггер показа ошибок после submit. */
  protected readonly submitted = signal(false);
  /** Текст ошибки сохранения (сервер/сеть) — ввод не теряется (H#B2-9). */
  protected readonly formError = signal<string | null>(null);
  /** Идёт сохранение (форма сама зовёт API). */
  protected readonly busy = signal(false);

  public constructor() {
    const ah = this._data.antiHabit;
    if (ah !== undefined) {
      this.hasTarget.set(ah.targetDays !== null);
      this.form.setValue({
        title: ah.title,
        description: ah.description ?? '',
        targetDays: ah.targetDays ?? 30,
        startDate: '',
      });
    }
  }

  /** Переключает «задать цель». */
  protected toggleTarget(): void {
    this.hasTarget.update((v) => !v);
  }

  /** Переключает «Начать не сегодня». */
  protected toggleStart(): void {
    this.startInFuture.update((v) => !v);
  }

  /** Текст ошибки даты старта (после submit). */
  protected startError(): string | null {
    if (!this.submitted() || !this.startInFuture()) {
      return null;
    }
    const v = this.form.controls.startDate.value;
    if (v === '') {
      return 'Выберите дату старта.';
    }
    return this._toMs(v) <= Date.now() ? 'Дата старта должна быть в будущем.' : null;
  }

  /** `YYYY-MM-DD` → unix ms локальной полуночи. */
  private _toMs(ymd: string): number {
    const p = ymd.split('-').map(Number);
    return new Date(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1).getTime();
  }

  /** `Date` → `YYYY-MM-DD` (локально). */
  private _toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Текст ошибки названия (после касания/submit). */
  protected titleError(): string | null {
    const c = this.form.controls.title;
    if ((!c.touched && !this.submitted()) || c.valid) {
      return null;
    }
    return c.errors?.['maxlength'] ? 'Название: максимум 160.' : 'Название обязательно.';
  }

  /** Сохраняет — собирает payload, зовёт API; закрывается лишь при успехе. */
  protected save(): void {
    if (this.busy()) {
      return;
    }
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    // Плановый старт (только при создании): дата обязана быть в будущем.
    let startAt: number | null = null;
    if (!this.isEdit && this.startInFuture()) {
      if (v.startDate === '' || this._toMs(v.startDate) <= Date.now()) {
        return;
      }
      startAt = this._toMs(v.startDate);
    }
    const description = v.description.trim();
    const payload: AntiHabitPayload = {
      title: v.title.trim(),
      description: description.length > 0 ? description : null,
      targetDays: this.hasTarget() ? v.targetDays : null,
    };
    // startAt кладём только для планового создания — в edit-режиме strict-DTO апдейта его отвергнет.
    if (startAt !== null) {
      payload.startAt = startAt;
    }
    this._submit(payload);
  }

  /**
   * Зовёт сохранение через `data.submit` (форма владеет вызовом API): при успехе закрывает с
   * payload, при ошибке — оставляет форму открытой с текстом (H#B2-9).
   * @param payload Собранное тело.
   */
  private _submit(payload: AntiHabitPayload): void {
    const run = this._data.submit;
    if (run === undefined) {
      this._ref.close(payload);
      return;
    }
    this.busy.set(true);
    run(payload)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this._ref.close(payload),
        error: (err: unknown) => this.formError.set(errorMessage(err)),
      });
  }

  /** Отмена — закрывает без результата. */
  protected cancel(): void {
    this._ref.close(null);
  }
}
