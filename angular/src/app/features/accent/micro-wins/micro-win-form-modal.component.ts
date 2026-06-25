import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { MICRO_WIN_CATEGORY_DESCRIPTIONS, MICRO_WIN_CATEGORY_LABELS } from '../accent.types';
import { CategoryGuideModalComponent } from './category-guide-modal.component';
import { FieldGuideModalComponent } from '../field-guide-modal.component';
import type { FieldGuideData } from '../field-guide-modal.component';
import type { MicroWinCategory, MicroWinPayload, MicroWinView } from '../accent.types';

/** Данные в модалку: если `microWin` задан — режим редактирования (префилл). */
export interface MicroWinFormData {
  /** Редактируемая микро-победа (или undefined — создание). */
  microWin?: MicroWinView;
}

/**
 * Модалка создания/редактирования микро-победы (MatDialog, ADR-0026). Реактивная
 * форма с зеркальной валидацией бэка (title 1..120, длительность 0..300, энергия 1..3).
 * Закрывается с `MicroWinPayload` (сохранить) или `null` (отмена). Создание/обновление
 * на бэке делает вызывающий список.
 */
@Component({
  selector: 'app-micro-win-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>{{ isEdit ? 'Изменить микро-победу' : 'Новая микро-победа' }}</h2>
      </div>

      <form class="dlg__form" [formGroup]="form" (ngSubmit)="save()">
        <div class="dlg__body mwf__form">
        <label class="mwf__field">
          <span class="mwf__label">
            Название <span class="mwf__req">*</span>
            <button type="button" class="mwf__help" (click)="openTitleGuide()">что это?</button>
          </span>
          <input class="mwf__input" type="text" maxlength="120" formControlName="title" placeholder="Напр. 1 отжимание" />
          @if (titleError()) {
            <span class="mwf__error">{{ titleError() }}</span>
          }
        </label>

        <label class="mwf__field">
          <span class="mwf__label">
            Категория
            <button type="button" class="mwf__help" (click)="openCategoryGuide()">что это?</button>
          </span>
          <select class="mwf__input" formControlName="category">
            @for (cat of categories; track cat.value) {
              <option [ngValue]="cat.value">{{ cat.label }}</option>
            }
          </select>
          <span class="mwf__hint">{{ categoryHint() }}</span>
        </label>

        <label class="mwf__field">
          <span class="mwf__label">
            Длительность, сек <span class="mwf__req">*</span>
            <button type="button" class="mwf__help" (click)="openDurationGuide()">что это?</button>
          </span>
          <input class="mwf__input" type="number" min="0" max="300" formControlName="durationSeconds" />
          @if (durationError()) {
            <span class="mwf__error">{{ durationError() }}</span>
          }
        </label>

        <label class="mwf__field">
          <span class="mwf__label">
            Цена энергии
            <button type="button" class="mwf__help" (click)="openEnergyGuide()">что это?</button>
          </span>
          <select class="mwf__input" formControlName="energyCost">
            <option [ngValue]="1">1 — низкая</option>
            <option [ngValue]="2">2 — средняя</option>
            <option [ngValue]="3">3 — высокая</option>
          </select>
        </label>

        <label class="mwf__field">
          <span class="mwf__label">
            Эффект <span class="mwf__opt">(необязательно)</span>
            <button type="button" class="mwf__help" (click)="openEffectGuide()">что это?</button>
          </span>
          <input class="mwf__input" type="text" formControlName="effect" placeholder="Что это даёт" />
        </label>

        </div>

        <div class="dlg__foot">
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
          <app-button type="submit" [disabled]="form.invalid">Сохранить</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .mwf__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .mwf__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .mwf__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .mwf__req {
        color: var(--color-danger);
      }
      .mwf__opt {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }
      .mwf__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
      }
      .mwf__input:focus {
        border-color: var(--color-accent);
      }
      .mwf__error {
        font-size: var(--fs-xs);
        color: var(--color-danger);
      }
      .mwf__hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .mwf__help {
        margin-left: var(--space-2);
        padding: 0;
        background: none;
        border: none;
        cursor: pointer;
        font-size: var(--fs-xs);
        color: var(--color-accent);
        text-decoration: underline;
      }
    `,
  ],
})
export class MicroWinFormModalComponent {
  private readonly _ref =
    inject<MatDialogRef<MicroWinFormModalComponent, MicroWinPayload | null>>(MatDialogRef);
  private readonly _data = inject<MicroWinFormData>(MAT_DIALOG_DATA);
  private readonly _dialog = inject(MatDialog);

  /** Режим редактирования (иначе создание). */
  protected readonly isEdit = this._data.microWin !== undefined;
  /** Опции категорий для select. */
  protected readonly categories = (
    Object.entries(MICRO_WIN_CATEGORY_LABELS) as [MicroWinCategory, string][]
  ).map(([value, label]) => ({ value, label }));

  /** Реактивная форма (валидаторы — зеркало бэка). */
  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    category: new FormControl<MicroWinCategory>('physical', { nonNullable: true }),
    durationSeconds: new FormControl(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(300)],
    }),
    energyCost: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(3)],
    }),
    effect: new FormControl('', { nonNullable: true }),
  });

  /** Триггер пере-вычисления ошибок после попытки сохранить. */
  protected readonly submitted = signal(false);

  /** Текущая выбранная категория (реактивно для подсказки). */
  private readonly _selectedCategory = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value,
  });
  /** Пояснение «что/зачем» по выбранной категории. */
  protected readonly categoryHint = computed(
    () => MICRO_WIN_CATEGORY_DESCRIPTIONS[this._selectedCategory()],
  );

  public constructor() {
    const mw = this._data.microWin;
    if (mw !== undefined) {
      this.form.setValue({
        title: mw.title,
        category: mw.category,
        durationSeconds: mw.durationSeconds,
        energyCost: mw.energyCost,
        effect: mw.effect ?? '',
      });
    }
  }

  /** Текст ошибки названия (после касания/submit). */
  protected titleError(): string | null {
    const c = this.form.controls.title;
    if ((!c.touched && !this.submitted()) || c.valid) {
      return null;
    }
    return c.errors?.['maxlength'] ? 'Название: максимум 120.' : 'Название обязательно.';
  }

  /** Текст ошибки длительности. */
  protected durationError(): string | null {
    const c = this.form.controls.durationSeconds;
    if ((!c.touched && !this.submitted()) || c.valid) {
      return null;
    }
    return 'Длительность: 0–300 секунд.';
  }

  /** Сохраняет — закрывает диалог с payload, если форма валидна. */
  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const effect = v.effect.trim();
    this._ref.close({
      title: v.title.trim(),
      category: v.category,
      durationSeconds: v.durationSeconds,
      energyCost: v.energyCost,
      effect: effect.length > 0 ? effect : null,
    });
  }

  /** Отмена — закрывает без результата. */
  protected cancel(): void {
    this._ref.close(null);
  }

  /** Открывает гид по категориям поверх формы (вложенный диалог; ввод не теряется). */
  protected openCategoryGuide(): void {
    this._dialog.open(CategoryGuideModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
    });
  }

  /** «Что это?» по названию. */
  protected openTitleGuide(): void {
    this._openGuide({
      title: 'Что писать в названии',
      paragraphs: [
        'Назови самый маленький, почти смешной шаг действия — такой, что отказаться от него сложнее, чем сделать.',
        'Не «тренировка», а «1 отжимание». Не «уборка», а «убрать одну вещь со стола». Смысл микро-победы — сдвинуться с нуля в плохой день, а не успеть много.',
      ],
    });
  }

  /** «Что это?» по длительности. */
  protected openDurationGuide(): void {
    this._openGuide({
      title: 'Зачем длительность',
      paragraphs: [
        'Примерная оценка, сколько секунд занимает действие (0–300). Помогает выбрать что-то крошечное, когда нет сил и времени совсем.',
        'Это ориентир для тебя, а не таймер: сейчас он ничего не запускает. Возможность включать обратный отсчёт по длительности — в планах на будущее.',
      ],
    });
  }

  /** «Что это?» по цене энергии. */
  protected openEnergyGuide(): void {
    this._openGuide({
      title: 'Что значит цена энергии',
      paragraphs: [
        'Сколько внутреннего усилия нужно: 1 — низкая (почти даром), 2 — средняя, 3 — высокая.',
        'В тяжёлый день выбирай дешёвые (1) — их реально сделать даже на нуле. Дорогие (3) приберегаешь на дни, когда есть ресурс.',
      ],
    });
  }

  /** «Что это?» по эффекту. */
  protected openEffectGuide(): void {
    this._openGuide({
      title: 'Зачем поле «Эффект»',
      paragraphs: [
        'Короткая заметка, что это действие тебе даёт: «просыпаюсь», «сбиваю тревогу», «выхожу из залипания».',
        'Необязательно. Но в плохой день эта строчка напомнит будущему тебе, ради чего вообще стоит сделать этот маленький шаг.',
      ],
    });
  }

  /** Открывает универсальный мини-гид поля поверх формы (ввод не теряется). */
  private _openGuide(data: FieldGuideData): void {
    this._dialog.open(FieldGuideModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      data,
    });
  }
}
