import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { NumberFieldComponent } from '../../../shared/ui/number-field/number-field.component';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { MICRO_WIN_CATEGORY_DESCRIPTIONS, MICRO_WIN_CATEGORY_LABELS } from '../accent.types';
import { AccentApiService } from '../services/accent-api.service';
import { CategoryGuideModalComponent } from './category-guide-modal.component';
import { FieldGuideModalComponent } from '../field-guide-modal.component';
import type { FieldGuideData } from '../field-guide-modal.component';
import type { AccentRefItem, MicroWinCategory, MicroWinPayload, MicroWinView } from '../accent.types';

/** Данные в модалку: если `microWin` задан — режим редактирования (префилл). */
export interface MicroWinFormData {
  /** Редактируемая микро-победа (или undefined — создание). */
  microWin?: MicroWinView;
  /**
   * Сохранение: форма САМА зовёт API и закрывается лишь при успехе; при ошибке остаётся
   * открытой с текстом ошибки — ввод не теряется (H#B2-9).
   */
  submit?: (payload: MicroWinPayload) => Observable<unknown>;
}

/**
 * Модалка создания/редактирования микро-победы (MatDialog, ADR-0026). Реактивная
 * форма с зеркальной валидацией бэка (title 1..120, длительность 0..300, энергия 1..3).
 * Закрывается с `MicroWinPayload` (сохранить) или `null` (отмена). Создание/обновление
 * на бэке делает вызывающий список.
 */
@Component({
  selector: 'app-micro-win-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, NumberFieldComponent],
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

        @if (domains().length > 0) {
          <label class="mwf__field">
            <span class="mwf__label">Сфера <span class="mwf__opt">(опц.)</span></span>
            <select class="mwf__input" formControlName="domainKey">
              <option [ngValue]="null">— не выбрана —</option>
              @for (dm of domains(); track dm.key) {
                <option [ngValue]="dm.key">{{ dm.title }}</option>
              }
            </select>
            <span class="mwf__hint">Какую область жизни это питает — как у целей и привычек (необязательно).</span>
          </label>
        }

        <label class="mwf__field">
          <span class="mwf__label">
            Длительность, сек <span class="mwf__req">*</span>
            <button type="button" class="mwf__help" (click)="openDurationGuide()">что это?</button>
          </span>
          <app-number-field formControlName="durationSeconds" [min]="0" [max]="300" label="Длительность (сек)" />
          @if (durationError()) {
            <span class="mwf__error">{{ durationError() }}</span>
          }
        </label>

        <div class="mwf__field">
          <span class="mwf__check">
            <label class="mwf__check-lbl">
              <input type="checkbox" [checked]="needsPrep()" (change)="toggleNeedsPrep()" />
              Нужно время на подготовку
            </label>
            <button type="button" class="mwf__help" (click)="openPrepGuide()">что это?</button>
          </span>
          @if (needsPrep()) {
            <app-number-field formControlName="prepSeconds" [min]="0" [max]="300" label="Подготовка (сек)"
              placeholder="например, 10" />
            <span class="mwf__hint">Отсчёт перед действием: успеть отложить телефон и приготовиться.</span>
          }
        </div>

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

        @if (formError(); as fe) {
          <span class="mwf__error">{{ fe }}</span>
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
      .mwf__check {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .mwf__check-lbl {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--fs-sm);
        color: var(--color-text);
        cursor: pointer;
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
  private readonly _api = inject(AccentApiService);

  /** Сферы жизни (опц. ось M#B3-1) — справочник `accent_domains`, общий со целями/привычками. */
  protected readonly domains = signal<AccentRefItem[]>([]);

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
    domainKey: new FormControl<string | null>(null),
    durationSeconds: new FormControl(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(300)],
    }),
    prepSeconds: new FormControl<number>(10, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(300)],
    }),
    energyCost: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(3)],
    }),
    effect: new FormControl('', { nonNullable: true }),
  });

  /** Триггер пере-вычисления ошибок после попытки сохранить. */
  protected readonly submitted = signal(false);
  /** Текст ошибки сохранения (сервер/сеть) — показывается в футере, ввод не теряется (H#B2-9). */
  protected readonly formError = signal<string | null>(null);
  /** Идёт сохранение (форма сама зовёт API) — кнопка заблокирована (H#B2-9). */
  protected readonly busy = signal(false);
  /**
   * Нужно ли время на подготовку (M#B3-4) — UI-галочка, в таблицу НЕ пишется. Вкл → виден input
   * `prepSeconds`; выкл → при сохранении `prepSeconds = null` (без подготовки).
   */
  protected readonly needsPrep = signal(false);

  /** Текущая выбранная категория (реактивно для подсказки). */
  private readonly _selectedCategory = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value,
  });
  /** Пояснение «что/зачем» по выбранной категории. */
  protected readonly categoryHint = computed(
    () => MICRO_WIN_CATEGORY_DESCRIPTIONS[this._selectedCategory()],
  );

  public constructor() {
    this._api.listDomains().subscribe({ next: (d) => this.domains.set(d), error: () => undefined });
    const mw = this._data.microWin;
    if (mw !== undefined) {
      this.needsPrep.set(mw.prepSeconds !== null && mw.prepSeconds > 0);
      this.form.setValue({
        title: mw.title,
        category: mw.category,
        domainKey: mw.domainKey,
        durationSeconds: mw.durationSeconds,
        prepSeconds: mw.prepSeconds ?? 10,
        energyCost: mw.energyCost,
        effect: mw.effect ?? '',
      });
    }
  }

  /** Переключает «нужна подготовка» (UI-галочка). */
  protected toggleNeedsPrep(): void {
    this.needsPrep.update((v) => !v);
  }

  /** Открывает гид «что это?» по времени на подготовку. */
  protected openPrepGuide(): void {
    this._dialog.open<FieldGuideModalComponent, FieldGuideData>(FieldGuideModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      data: {
        title: 'Время на подготовку',
        paragraphs: [
          'Отсчёт ПЕРЕД самим действием — чтобы успеть приготовиться: нажать «старт», отложить телефон, лечь на пол, встать в планку.',
          'Когда подготовка закончится — прозвучит сигнал «начали», и пойдёт отсчёт самого действия. Если подготовка не нужна — оставь галочку снятой, действие начнётся сразу.',
        ],
      },
    });
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
    const effect = v.effect.trim();
    const payload: MicroWinPayload = {
      title: v.title.trim(),
      category: v.category,
      domainKey: v.domainKey ?? null,
      durationSeconds: v.durationSeconds,
      prepSeconds: this.needsPrep() ? v.prepSeconds : null,
      energyCost: v.energyCost,
      effect: effect.length > 0 ? effect : null,
    };
    this._submit(payload);
  }

  /**
   * Зовёт сохранение через `data.submit` (форма владеет вызовом API): при успехе закрывает с
   * payload, при ошибке — оставляет форму открытой и показывает текст ошибки (H#B2-9). Без
   * `submit` (страховка) — старое поведение: просто закрыть с payload.
   */
  private _submit(payload: MicroWinPayload): void {
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
      paragraphs: ['Сколько внутреннего усилия нужно на действие:'],
      bullets: [
        { term: '1 — низкая', desc: 'почти даром, реально сделать даже на нуле.' },
        { term: '2 — средняя', desc: 'нужно немного собраться.' },
        { term: '3 — высокая', desc: 'приберегаешь на дни, когда есть ресурс.' },
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
