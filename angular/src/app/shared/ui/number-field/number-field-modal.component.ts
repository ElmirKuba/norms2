import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../button/button.component';

/** Данные модалки редактирования числа (узкий режим `app-number-field`). */
export interface NumberFieldModalData {
  value: number | null;
  min: number | null;
  max: number | null;
  step: number;
  label: string;
  placeholder: string;
}

/**
 * Мини-модалка ввода числа (узкий режим `NumberFieldComponent`): крупные «−»/«+» вокруг поля +
 * общая кнопка «Сохранить» во всю ширину. Закрытие крестиком = отмена (значение не меняется).
 * Возвращает новое значение (`number | null`) при сохранении, `undefined` при отмене.
 */
@Component({
  selector: 'app-number-field-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nfm">
      <div class="nfm__head">
        <span class="nfm__label">{{ data.label || 'Значение' }}</span>
        <button type="button" class="nfm__close" aria-label="Закрыть" (click)="close()">✕</button>
      </div>
      <div class="nfm__row">
        <button type="button" class="nfm__btn" aria-label="Убавить" (click)="dec()">−</button>
        <input
          #inp
          class="nfm__input"
          type="number"
          inputmode="decimal"
          [value]="value() ?? ''"
          [attr.min]="data.min"
          [attr.max]="data.max"
          [attr.step]="data.step"
          [attr.placeholder]="data.placeholder"
          (input)="onInput(inp.value)"
        />
        <button type="button" class="nfm__btn" aria-label="Прибавить" (click)="inc()">+</button>
      </div>
      <app-button [block]="true" (click)="save()">Сохранить</app-button>
    </div>
  `,
  styles: [
    `
      .nfm {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding: var(--space-5) var(--space-4);
      }
      .nfm__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .nfm__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .nfm__close {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-md);
        min-width: var(--touch-min);
        min-height: var(--touch-min);
      }
      .nfm__close:hover {
        color: var(--color-text);
      }
      .nfm__row {
        display: flex;
        gap: var(--space-2);
        align-items: stretch;
      }
      .nfm__btn {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-accent);
        cursor: pointer;
        font-size: var(--fs-lg);
        line-height: 1;
      }
      .nfm__btn:hover {
        background: var(--color-accent);
        color: var(--color-on-accent, #fff);
      }
      .nfm__input {
        flex: 1;
        min-width: 0;
        text-align: center;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
        appearance: textfield;
        -moz-appearance: textfield;
      }
      .nfm__input::-webkit-inner-spin-button,
      .nfm__input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    `,
  ],
})
export class NumberFieldModalComponent {
  /** Данные модалки. */
  protected readonly data = inject<NumberFieldModalData>(MAT_DIALOG_DATA);
  private readonly _ref =
    inject<MatDialogRef<NumberFieldModalComponent, number | null | undefined>>(MatDialogRef);
  /** Локальное значение (коммитим только по «Сохранить»). */
  protected readonly value = signal<number | null>(this.data.value);

  /** Убавить на шаг. */
  protected dec(): void {
    this._step(-this.data.step);
  }

  /** Прибавить на шаг. */
  protected inc(): void {
    this._step(this.data.step);
  }

  private _step(delta: number): void {
    this.value.set(this._clamp((this.value() ?? 0) + delta));
  }

  private _clamp(v: number): number {
    let x = v;
    if (this.data.min !== null && x < this.data.min) {
      x = this.data.min;
    }
    if (this.data.max !== null && x > this.data.max) {
      x = this.data.max;
    }
    return x;
  }

  /** Ручной ввод: пусто → null, иначе число. */
  protected onInput(raw: string): void {
    this.value.set(raw.trim() === '' ? null : Number(raw));
  }

  /** Сохранить — вернуть значение. */
  protected save(): void {
    this._ref.close(this.value());
  }

  /** Отмена — вернуть undefined (без изменения). */
  protected close(): void {
    this._ref.close(undefined);
  }
}
