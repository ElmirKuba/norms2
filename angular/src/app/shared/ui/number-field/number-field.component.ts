import { ChangeDetectionStrategy, Component, Input, forwardRef, inject, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MODAL_SMALL_WIDTH } from '../../modals/modals.constants';
import { NumberFieldModalComponent } from './number-field-modal.component';
import type { NumberFieldModalData } from './number-field-modal.component';

/**
 * Числовое поле с собственными «−»/«+» (без нативного спиннера), заменяет `input[type=number]`.
 * Реактивная форма — через `ControlValueAccessor` (ставится на `formControlName`).
 *
 * **Адаптив без JS (container query):** если СВОЯ ширина поля не вмещает три элемента (`−` поле `+`),
 * компонент сворачивается в компактный триггер-«поле»; тап открывает мини-модалку с тем же
 * степпером и «Сохранить». Именно container query (а не `@media`): одно и то же поле бывает и
 * во всю ширину, и втиснутым в плотный ряд лесенки — на одном вьюпорте; решает собственная ширина.
 * В любом режиме число всегда можно ВВЕСТИ с клавиатуры — `−/+` лишь для мелкой докрутки.
 */
@Component({
  selector: 'app-number-field',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumberFieldComponent), multi: true },
  ],
  template: `
    <div class="nf">
      <div class="nf__inline">
        <button type="button" class="nf__btn" aria-label="Убавить" [disabled]="disabled()" (click)="dec()">−</button>
        <input
          #inp
          class="nf__input"
          type="number"
          inputmode="decimal"
          [value]="value() ?? ''"
          [disabled]="disabled()"
          [attr.min]="min"
          [attr.max]="max"
          [attr.step]="step"
          [attr.placeholder]="placeholder"
          [attr.aria-label]="label || null"
          (input)="onInput(inp.value)"
          (blur)="onTouched()"
        />
        <button type="button" class="nf__btn" aria-label="Прибавить" [disabled]="disabled()" (click)="inc()">+</button>
      </div>
      <button
        type="button"
        class="nf__collapsed"
        [class.nf__collapsed--empty]="value() === null"
        [disabled]="disabled()"
        (click)="openModal()"
      >{{ value() ?? placeholder }}</button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .nf {
        container-type: inline-size;
      }
      .nf__inline {
        display: flex;
        gap: var(--space-1);
        align-items: stretch;
      }
      .nf__collapsed {
        display: none;
      }
      /* Не вмещает «− поле +» адекватно → компактный триггер + модалка (см. класс-док). */
      @container (max-width: 13rem) {
        .nf__inline {
          display: none;
        }
        .nf__collapsed {
          display: block;
          width: 100%;
          text-align: left;
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: var(--color-text);
          font: inherit;
          cursor: pointer;
        }
        .nf__collapsed--empty {
          color: var(--color-text-muted);
        }
      }
      .nf__btn {
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
      .nf__btn:hover:not(:disabled) {
        background: var(--color-accent);
        color: var(--color-on-accent, #fff);
      }
      .nf__btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .nf__input {
        flex: 1;
        min-width: 0;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
        appearance: textfield;
        -moz-appearance: textfield;
      }
      .nf__input::-webkit-inner-spin-button,
      .nf__input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    `,
  ],
})
export class NumberFieldComponent implements ControlValueAccessor {
  private readonly _dialog = inject(MatDialog);

  /** Нижняя граница (опц.). */
  @Input() public min: number | null = null;
  /** Верхняя граница (опц.). */
  @Input() public max: number | null = null;
  /** Шаг «−»/«+» (по умолчанию 1). */
  @Input() public step = 1;
  /** Плейсхолдер поля. */
  @Input() public placeholder = '';
  /** Подпись (для aria и заголовка модалки узкого режима). */
  @Input() public label = '';

  /** Текущее значение. */
  protected readonly value = signal<number | null>(null);
  /** Заблокировано ли (из формы). */
  protected readonly disabled = signal(false);

  private _onChange: (v: number | null) => void = () => {};
  /** Тач (для валидации формы). */
  protected onTouched: () => void = () => {};

  // --- ControlValueAccessor ---
  public writeValue(value: number | null): void {
    this.value.set(value ?? null);
  }
  public registerOnChange(fn: (v: number | null) => void): void {
    this._onChange = fn;
  }
  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  public setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  /** Убавить на шаг. */
  protected dec(): void {
    this._commit(this._clamp((this.value() ?? 0) - this.step));
  }

  /** Прибавить на шаг. */
  protected inc(): void {
    this._commit(this._clamp((this.value() ?? 0) + this.step));
  }

  /** Ручной ввод: пусто → null, иначе число. */
  protected onInput(raw: string): void {
    this._commit(raw.trim() === '' ? null : Number(raw));
  }

  /** Узкий режим: открыть мини-модалку; по «Сохранить» — коммитим значение. */
  protected openModal(): void {
    const data: NumberFieldModalData = {
      value: this.value(),
      min: this.min,
      max: this.max,
      step: this.step,
      label: this.label,
      placeholder: this.placeholder,
    };
    const ref = this._dialog.open<NumberFieldModalComponent, NumberFieldModalData, number | null | undefined>(
      NumberFieldModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush', data },
    );
    ref.afterClosed().subscribe((result) => {
      if (result !== undefined) {
        this._commit(result);
      }
      this.onTouched();
    });
  }

  private _clamp(v: number): number {
    let x = v;
    if (this.min !== null && x < this.min) {
      x = this.min;
    }
    if (this.max !== null && x > this.max) {
      x = this.max;
    }
    return x;
  }

  private _commit(value: number | null): void {
    this.value.set(value);
    this._onChange(value);
  }
}
