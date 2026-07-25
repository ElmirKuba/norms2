import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/**
 * Модалка переноса старта «держусь» в будущее (ADR-0059). Дата+время (с точностью до секунды,
 * строго в будущем) → возвращает `startAt` (unix ms) или `null` (отмена). Текущая попытка
 * завершится, серия начнётся с нового момента (планирование). Бэкфилл в прошлое невозможен.
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
            Текущая попытка завершится, а серия начнётся заново с выбранного момента. Это
            планирование «начну с…», а не отметка о срыве. По умолчанию — начало новых суток
            (00:00:00), но час/минуты/секунды можно поправить.
          </p>
          <label class="arsm__field">
            <span class="arsm__label">Дата и время старта <span class="arsm__req">*</span></span>
            <input
              class="arsm__input"
              type="datetime-local"
              step="1"
              [min]="minDateTime"
              formControlName="startAt"
            />
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

  /** Минимум выбора — «сейчас» (перенос строго в будущее; локальный `datetime-local`). */
  protected readonly minDateTime = this._toLocalInput(new Date());
  /** Показать ошибку после submit. */
  protected readonly submitted = signal(false);

  /** Форма: дата+время старта. Дефолт — начало завтрашних суток (00:00:00), час/мин/сек правятся. */
  protected readonly form = new FormGroup({
    startAt: new FormControl(this._tomorrowMidnight(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Текст ошибки момента старта. */
  protected dateError(): string | null {
    if (!this.submitted()) {
      return null;
    }
    const v = this.form.controls.startAt.value;
    if (v === '') {
      return 'Выберите дату и время.';
    }
    return this._toMs(v) <= Date.now() ? 'Момент старта должен быть в будущем.' : null;
  }

  /** Подтвердить — вернуть startAt (ms) выбранного момента. */
  protected confirm(): void {
    this.submitted.set(true);
    const v = this.form.controls.startAt.value;
    const ms = this._toMs(v);
    if (v === '' || Number.isNaN(ms) || ms <= Date.now()) {
      return;
    }
    this._ref.close(ms);
  }

  /** Отмена. */
  protected cancel(): void {
    this._ref.close(null);
  }

  /** `datetime-local` (`YYYY-MM-DDTHH:mm[:ss]`, локальное время) → unix ms. */
  private _toMs(local: string): number {
    return new Date(local).getTime();
  }

  /** Начало завтрашних суток (00:00:00) как строка для `datetime-local` (локально). */
  private _tomorrowMidnight(): string {
    const t = new Date();
    return this._toLocalInput(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0));
  }

  /** `Date` → строка для `datetime-local` (`YYYY-MM-DDTHH:mm:ss`, локально). */
  private _toLocalInput(date: Date): string {
    const p = (n: number): string => String(n).padStart(2, '0');
    const ymd = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    return `${ymd}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  }
}
