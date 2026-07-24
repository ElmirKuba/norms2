import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/**
 * Модалка переноса старта «держусь» в будущее (ADR-0059). Дата (не раньше завтра) → возвращает
 * `startAt` (unix ms, локальная полночь выбранного дня) или `null` (отмена). Текущая попытка
 * завершится, серия начнётся с новой даты (планирование). Бэкфилл в прошлое невозможен.
 */
@Component({
  selector: 'app-anti-habit-reschedule-modal',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>Перенести старт</h2>
      </div>
      <form class="dlg__form" [formGroup]="form" (ngSubmit)="confirm()">
        <div class="dlg__body arsm__form">
          <p class="arsm__lead">
            Текущая попытка завершится, а серия начнётся заново с выбранной даты. Это планирование
            «начну с…», а не отметка о срыве.
          </p>
          <label class="arsm__field">
            <span class="arsm__label">Дата старта <span class="arsm__req">*</span></span>
            <input class="arsm__input" type="date" [min]="minDate" formControlName="date" />
            @if (dateError()) {
              <span class="arsm__error">{{ dateError() }}</span>
            }
          </label>
        </div>
        <div class="dlg__foot">
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
          <app-button type="submit" [disabled]="form.invalid">Перенести</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .arsm__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .arsm__lead {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .arsm__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .arsm__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .arsm__req {
        color: var(--color-danger);
      }
      .arsm__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
      }
      .arsm__input:focus {
        border-color: var(--color-accent);
      }
      .arsm__error {
        font-size: var(--fs-xs);
        color: var(--color-danger);
      }
    `,
  ],
})
export class AntiHabitRescheduleModalComponent {
  private readonly _ref =
    inject<MatDialogRef<AntiHabitRescheduleModalComponent, number | null>>(MatDialogRef);

  /** Минимум — завтра (YYYY-MM-DD). */
  protected readonly minDate = this._toYmd(new Date(Date.now() + 86_400_000));
  /** Показать ошибку после submit. */
  protected readonly submitted = signal(false);

  /** Форма: одна дата. */
  protected readonly form = new FormGroup({
    date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** Текст ошибки даты. */
  protected dateError(): string | null {
    if (!this.submitted()) {
      return null;
    }
    const v = this.form.controls.date.value;
    if (v === '') {
      return 'Выберите дату.';
    }
    return this._toMs(v) <= Date.now() ? 'Дата должна быть в будущем.' : null;
  }

  /** Подтвердить — вернуть startAt (ms) локальной полуночи выбранного дня. */
  protected confirm(): void {
    this.submitted.set(true);
    const v = this.form.controls.date.value;
    if (v === '' || this._toMs(v) <= Date.now()) {
      return;
    }
    this._ref.close(this._toMs(v));
  }

  /** Отмена. */
  protected cancel(): void {
    this._ref.close(null);
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
}
