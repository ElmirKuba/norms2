import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { OBSTACLE_TYPE_OPTIONS } from './obstacle-format.util';
import type { ObstaclePayload, ObstacleType, ObstacleView } from '../accent.types';

/** Данные в модалку: если `obstacle` задан — режим редактирования (префилл). */
export interface ObstacleFormData {
  /** Редактируемое препятствие (или undefined — создание). */
  obstacle?: ObstacleView;
  /**
   * Сохранение: форма САМА зовёт API и закрывается лишь при успехе; при ошибке остаётся
   * открытой с текстом — ввод не теряется (паттерн H#B2-9).
   */
  submit?: (payload: ObstaclePayload) => Observable<unknown>;
}

/**
 * Модалка создания/правки препятствия (MatDialog, ADR-0026). Поля: название, **вид**
 * (обязателен — по нему потом подбирает рекомендатель 2.8), повод, признаки и «насколько
 * давит» 1..5. Валидаторы — зеркало бэка. Свободные поля → подсказка «без ПДн» (ui-ux §9):
 * здесь она особенно нужна, раздел провоцирует писать про конкретных людей.
 */
@Component({
  selector: 'app-obstacle-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>{{ isEdit ? 'Изменить препятствие' : 'Что мешает?' }}</h2>
      </div>

      <form class="dlg__form" [formGroup]="form" (ngSubmit)="save()">
        <div class="dlg__body obf__form">
          <label class="obf__field">
            <span class="obf__label">Название <span class="obf__req">*</span></span>
            <input
              class="obf__input"
              type="text"
              maxlength="160"
              formControlName="name"
              placeholder="Напр. думскролл / «у меня не получится»"
            />
            <span class="obf__hint">Назови так, как узнаёшь его в момент, когда оно приходит.</span>
            @if (nameError()) {
              <span class="obf__error">{{ nameError() }}</span>
            }
          </label>

          <label class="obf__field">
            <span class="obf__label">Вид <span class="obf__req">*</span></span>
            <select class="obf__input" formControlName="type">
              @for (opt of typeOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.icon }} {{ opt.label }}</option>
              }
            </select>
            <span class="obf__hint">Это про природу помехи, а не про твой характер.</span>
          </label>

          <label class="obf__field">
            <span class="obf__label">Когда приходит <span class="obf__opt">(необязательно)</span></span>
            <input
              class="obf__input"
              type="text"
              maxlength="2000"
              formControlName="trigger"
              placeholder="Напр. вечером, когда устал"
            />
          </label>

          <label class="obf__field">
            <span class="obf__label">Как узнаю <span class="obf__opt">(необязательно)</span></span>
            <textarea
              class="obf__input obf__area"
              rows="2"
              maxlength="2000"
              formControlName="symptoms"
              placeholder="Напр. открываю ленту не думая"
            ></textarea>
            <span class="obf__hint">Без реальных имён, телефонов и адресов.</span>
          </label>

          <div class="obf__field">
            <span class="obf__label">Насколько давит: {{ form.controls.intensity.value }} из 5</span>
            <input
              class="obf__range"
              type="range"
              min="1"
              max="5"
              step="1"
              formControlName="intensity"
            />
            <span class="obf__hint">Это самочувствие на сегодня, а не диагноз — поменяешь когда угодно.</span>
          </div>
        </div>

        @if (formError(); as fe) {
          <span class="obf__error">{{ fe }}</span>
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
      .obf__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .obf__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .obf__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .obf__req {
        color: var(--color-danger);
      }
      .obf__opt {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }
      .obf__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
      }
      .obf__area {
        resize: vertical;
        min-height: 3rem;
      }
      .obf__input:focus {
        border-color: var(--color-accent);
      }
      .obf__range {
        width: 100%;
        accent-color: var(--color-accent);
      }
      .obf__error {
        font-size: var(--fs-xs);
        color: var(--color-danger);
      }
      .obf__hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class ObstacleFormModalComponent {
  private readonly _ref =
    inject<MatDialogRef<ObstacleFormModalComponent, ObstaclePayload | null>>(MatDialogRef);
  private readonly _data = inject<ObstacleFormData>(MAT_DIALOG_DATA);

  /** Режим редактирования (иначе создание). */
  protected readonly isEdit = this._data.obstacle !== undefined;

  /** Виды препятствий для селекта (ярлыки и иконки — общий util). */
  protected readonly typeOptions = OBSTACLE_TYPE_OPTIONS;

  /** Реактивная форма (валидаторы — зеркало бэка). */
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    type: new FormControl<ObstacleType>('avoidance', { nonNullable: true }),
    trigger: new FormControl('', { nonNullable: true }),
    symptoms: new FormControl('', { nonNullable: true }),
    intensity: new FormControl<number>(3, { nonNullable: true }),
  });

  /** Идёт сохранение. */
  protected readonly busy = signal(false);
  /** Ошибка сохранения (форма остаётся открытой — ввод не теряется). */
  protected readonly formError = signal<string | null>(null);

  public constructor() {
    const obstacle = this._data.obstacle;
    if (obstacle) {
      this.form.patchValue({
        name: obstacle.name,
        type: obstacle.type,
        trigger: obstacle.trigger ?? '',
        symptoms: obstacle.symptoms ?? '',
        intensity: obstacle.intensity,
      });
    }
  }

  /**
   * Текст ошибки поля «Название» или null.
   * @returns Сообщение или null.
   */
  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Название обязательно.';
    }
    if (control.hasError('maxlength')) {
      return 'Название: максимум 160.';
    }
    return null;
  }

  /** Собирает payload и сохраняет через переданный `submit`; закрывается только при успехе. */
  protected save(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }
    const raw = this.form.getRawValue();
    const payload: ObstaclePayload = {
      name: raw.name.trim(),
      type: raw.type,
      trigger: raw.trigger.trim() === '' ? null : raw.trigger.trim(),
      symptoms: raw.symptoms.trim() === '' ? null : raw.symptoms.trim(),
      intensity: raw.intensity,
    };
    const submit = this._data.submit;
    if (!submit) {
      this._ref.close(payload);
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    submit(payload)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this._ref.close(payload),
        error: (err: unknown) => this.formError.set(errorMessage(err)),
      });
  }

  /** Закрывает модалку без сохранения. */
  protected cancel(): void {
    this._ref.close(null);
  }
}
