import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { NumberFieldComponent } from '../../../shared/ui/number-field/number-field.component';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { GOAL_DIRECTION_DESCRIPTIONS, GOAL_DIRECTION_LABELS } from '../accent.types';
import { FieldGuideModalComponent } from '../field-guide-modal.component';
import type { FieldGuideData } from '../field-guide-modal.component';
import type {
  AccentRefItem,
  GoalDirection,
  GoalPayload,
  GoalProgressView,
  GoalUpdatePayload,
  GoalView,
} from '../accent.types';

/** Данные в модалку: если `goal` задан — режим редактирования. */
/** Результат: payload создания (новая цель) или обновления (edit) — по полю `mode`. */
export type GoalFormResult =
  | { mode: 'create'; payload: GoalPayload }
  | { mode: 'update'; payload: GoalUpdatePayload };

/** Данные в модалку: если `goal` задан — режим редактирования. */
export interface GoalFormData {
  /** Редактируемая цель (или undefined — создание). */
  goal?: GoalView;
  /** Предзаданный родитель (создать подцелью этой цели) — скрывает выбор родителя. */
  presetParentId?: string;
  /**
   * Сохранение: форма САМА зовёт API и закрывается лишь при успехе; при ошибке остаётся
   * открытой с текстом ошибки — ввод не теряется (H#B2-9).
   */
  submit?: (result: GoalFormResult) => Observable<unknown>;
}

/** Роды цели для select. */
const DIRECTIONS: readonly GoalDirection[] = ['accumulate', 'reach', 'reduce', 'maintain'];

/**
 * Контекстные мини-гиды «что это?» по полям формы цели. Открываются общим
 * `FieldGuideModalComponent`. Тексты — просто, по-человечески ([[ui-copy-plain-simple]]).
 */
const GOAL_FIELD_GUIDES: Record<string, FieldGuideData> = {
  title: {
    title: 'Название цели',
    paragraphs: [
      'Чего хочешь достичь, коротко: «Пробежать полумарафон», «Накопить подушку на 6 месяцев».',
      'Конкретная формулировка с числом легче измеряется и сильнее мотивирует, чем размытое «заняться спортом».',
    ],
  },
  why: {
    title: 'Зачем это важно',
    paragraphs: [
      'Якорь смысла: к чему ведёт цель, ради чего она. Необязательно.',
      'В трудный момент это «зачем» удержит, когда мотивация просядет.',
    ],
  },
  tradeoff: {
    title: 'Ради чего откажусь',
    paragraphs: [
      'Что ты сознательно отложишь или уберёшь ради этой цели (время, другие дела, привычки).',
      '«Акцент» — про выбор главного через отказ от лишнего. Это поле нужно, чтобы взять накопительную цель в фокус: фокус — про единицы, а не про «ещё одну цель в кучу».',
    ],
  },
  direction: {
    title: 'Род цели',
    paragraphs: ['Четыре рода — от рода зависит, как считается прогресс и какие поля нужны:'],
    bullets: [
      { term: 'Накопить', desc: 'растишь сумму к числу: книги, деньги, км.' },
      { term: 'Достичь уровня', desc: 'приходишь к значению от старта: вес, время забега.' },
      { term: 'Снизить', desc: 'уменьшаешь ниже старта: вес, траты, экранное время.' },
      { term: 'Удерживать', desc: 'держишь значение в коридоре: сон, пульс.' },
    ],
  },
  target: {
    title: 'Целевое значение',
    paragraphs: [
      'Число, к которому идёшь. Для «удерживать» — верхняя граница коридора.',
      'Для «накопить» — больше 0; для «достичь/снизить» — должно отличаться от стартового замера.',
    ],
  },
  unit: {
    title: 'Единица',
    paragraphs: [
      'В чём измеряешь: км, кг, ₽, книги, часы, минуты…',
      'Просто подпись к числам, чтобы прогресс читался понятно.',
    ],
  },
  start: {
    title: 'Старт / нижняя граница',
    paragraphs: [
      'Для «достичь/снизить» — текущий замер, от которого считается прогресс (для «снизить» цель ниже старта).',
      'Для «удерживать» — нижняя граница коридора: замер «в коридоре», если он между нижней и верхней границей.',
    ],
  },
  deadline: {
    title: 'Срок',
    paragraphs: [
      'Дата, к которой хочешь прийти. Необязательно.',
      'Со сроком появляется прогноз: «при текущем темпе — успеешь / стоит поднажать».',
    ],
  },
  domain: {
    title: 'Сфера',
    paragraphs: [
      'Область жизни цели (здоровье, финансы, отношения…). Необязательно.',
      'Помогает видеть баланс — не перекошены ли все цели в одну сторону.',
    ],
  },
  attributes: {
    title: 'Что прокачивает',
    paragraphs: [
      'Как в RPG: цель качает характеристику (силу, дисциплину, ум…). Необязательно.',
      'Для наглядного «роста персонажа». Не уверен — пропусти.',
    ],
  },
  parent: {
    title: 'Родительская цель',
    paragraphs: [
      'Можешь сделать эту цель подцелью другой — тогда её прогресс вносит вклад в родителя.',
      'Необязательно. Так большие цели разбиваются на понятные шаги.',
    ],
  },
  fallback: {
    title: 'Версия на плохой день',
    paragraphs: [
      'Минимальная версия движения к цели, когда нет сил на полноценный шаг.',
      'Смысл — не обнулиться: сделал хоть минимум — цель жива, темп не рвётся.',
    ],
  },
};

/**
 * Модалка создания/редактирования цели (2.5·16). Reactive-форма; в режиме edit `direction`/
 * `startValue`/`parentGoalId` **иммутабельны** (скрыты) — зеркало бэка (ADR-0052). Числовые
 * инварианты (accumulate `target>0`; reach/reduce `target≠start`) проверяются и здесь
 * (дружелюбно), и на бэке. Справка — контекстные «что это?» по полям (`FieldGuideModalComponent`).
 * Возвращает `GoalFormResult` (create/update) или null (отмена).
 */
@Component({
  selector: 'app-goal-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, NumberFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>{{ isEdit ? 'Изменить цель' : 'Новая цель' }}</h2>
      </div>
      <form class="dlg__form" [formGroup]="form" (ngSubmit)="save()">
        <div class="dlg__body gf__fields">
      <label class="gf__field">
        <span class="gf__label">
          Название
          <button type="button" class="gf__help" (click)="openGuide('title')">что это?</button>
        </span>
        <input class="gf__input" type="text" maxlength="160" formControlName="title" />
        @if (titleError()) {
          <span class="gf__hint gf__hint--err">{{ titleError() }}</span>
        }
      </label>

      <label class="gf__field">
        <span class="gf__label">
          Зачем это важно <span class="gf__opt">(опц.)</span>
          <button type="button" class="gf__help" (click)="openGuide('why')">что это?</button>
        </span>
        <textarea class="gf__input" rows="2" maxlength="2000" formControlName="whyItMatters"
          placeholder="Якорь смысла — к чему ведёт эта цель"></textarea>
      </label>

      @if (isAccumulate()) {
        <p class="gf__mission-hint">Это про важное — или просто «делать больше»?</p>
        <label class="gf__field">
          <span class="gf__label">
            Ради чего откажусь <span class="gf__opt">(опц.)</span>
            <button type="button" class="gf__help" (click)="openGuide('tradeoff')">что это?</button>
          </span>
          <input class="gf__input" type="text" maxlength="280" formControlName="tradeoff"
            placeholder="Что отложу ради этой цели" />
          <span class="gf__hint">Нужно, чтобы взять цель в фокус.</span>
        </label>
      }

      @if (!isEdit) {
        <label class="gf__field">
          <span class="gf__label">
            Род цели
            <button type="button" class="gf__help" (click)="openGuide('direction')">что это?</button>
          </span>
          <select class="gf__input" formControlName="direction">
            @for (d of directions; track d) {
              <option [value]="d">{{ directionLabel(d) }}</option>
            }
          </select>
          <span class="gf__hint">{{ directionHint() }}</span>
        </label>
      }

      <div class="gf__row">
        <label class="gf__field gf__field--num">
          <span class="gf__label">
            {{ isMaintain() ? 'Верхняя граница' : 'Цель' }} ({{ form.controls.unit.value || 'ед.' }})
            <button type="button" class="gf__help" (click)="openGuide('target')">что это?</button>
          </span>
          <app-number-field formControlName="targetValue" label="Цель" />
          @if (targetError()) {
            <span class="gf__hint gf__hint--err">{{ targetError() }}</span>
          }
        </label>
        <label class="gf__field gf__field--num">
          <span class="gf__label">
            Единица
            <button type="button" class="gf__help" (click)="openGuide('unit')">что это?</button>
          </span>
          <input class="gf__input" type="text" maxlength="32" formControlName="unit" />
          @if (unitError()) {
            <span class="gf__hint gf__hint--err">{{ unitError() }}</span>
          }
        </label>
      </div>

      @if (showStart()) {
        <label class="gf__field">
          <span class="gf__label">
            {{ isMaintain() ? 'Нижняя граница' : 'Старт (текущий замер' }}{{ isMaintain() ? (isEdit ? ' (неизменна)' : '') : (isEdit ? ', неизменен)' : ')') }}
            <button type="button" class="gf__help" (click)="openGuide('start')">что это?</button>
          </span>
          <app-number-field formControlName="startValue" label="Старт"
            [isReadonly]="isEdit" />
          @if (startError()) {
            <span class="gf__hint gf__hint--err">{{ startError() }}</span>
          }
          @if (isMaintain()) {
            <span class="gf__hint">Замер «в коридоре», если между нижней и верхней границей.</span>
          } @else {
            <span class="gf__hint">От него считается прогресс. Для «снизить» цель ниже старта.</span>
          }
        </label>
      }

      <label class="gf__field">
        <span class="gf__label">
          Срок <span class="gf__opt">(опц.)</span>
          <button type="button" class="gf__help" (click)="openGuide('deadline')">что это?</button>
        </span>
        <input class="gf__input" type="date" formControlName="deadline" />
      </label>

      @if (domains().length > 0) {
        <label class="gf__field">
          <span class="gf__label">
            Сфера <span class="gf__opt">(опц.)</span>
            <button type="button" class="gf__help" (click)="openGuide('domain')">что это?</button>
          </span>
          <select class="gf__input" formControlName="domainKey">
            <option [ngValue]="null">— не выбрана —</option>
            @for (dm of domains(); track dm.key) {
              <option [ngValue]="dm.key">{{ dm.title }}</option>
            }
          </select>
        </label>
      }

      @if (attributesCatalog().length > 0) {
        <div class="gf__field">
          <span class="gf__label">
            Что прокачивает <span class="gf__opt">(опц.)</span>
            <button type="button" class="gf__help" (click)="openGuide('attributes')">что это?</button>
          </span>
          <div class="gf__chips">
            @for (a of attributesCatalog(); track a.key) {
              <button type="button" class="gf__chip" [class.gf__chip--on]="attrs().has(a.key)"
                (click)="toggleAttr(a.key)">{{ a.title }}</button>
            }
          </div>
        </div>
      }

      @if (showParentSelect() && parents().length > 0) {
        <label class="gf__field">
          <span class="gf__label">
            Родительская цель <span class="gf__opt">(опц. — сделать подцелью)</span>
            <button type="button" class="gf__help" (click)="openGuide('parent')">что это?</button>
          </span>
          <select class="gf__input" formControlName="parentGoalId">
            <option [ngValue]="null">— самостоятельная —</option>
            @for (p of parents(); track p.id) {
              <option [ngValue]="p.id">{{ p.title }}</option>
            }
          </select>
        </label>
      }

      <label class="gf__field">
        <span class="gf__label">
          Версия на плохой день <span class="gf__opt">(опц.)</span>
          <button type="button" class="gf__help" (click)="openGuide('fallback')">что это?</button>
        </span>
        <input class="gf__input" type="text" maxlength="280" formControlName="fallbackVersion"
          placeholder="Минимум, который держит цель живой" />
      </label>

      @if (formError(); as fe) {
        <p class="gf__error">{{ fe }}</p>
      }
        </div>

        <div class="dlg__foot">
          <app-button variant="ghost" type="button" (click)="cancel()">Отмена</app-button>
          <app-button type="submit" [loading]="busy()">Сохранить</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .gf__fields {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .gf__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .gf__field--num {
        flex: 1;
      }
      .gf__row {
        display: flex;
        gap: var(--space-3);
        align-items: flex-end;
      }
      .gf__row > * {
        flex: 1;
      }
      .gf__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .gf__opt {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .gf__help {
        margin-left: var(--space-2);
        padding: 0;
        background: none;
        border: none;
        cursor: pointer;
        font-size: var(--fs-xs);
        color: var(--color-accent);
        text-decoration: underline;
      }
      .gf__input {
        width: 100%;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
      }
      .gf__hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .gf__hint--err {
        color: var(--color-danger);
      }
      .gf__mission-hint {
        margin: calc(-1 * var(--space-1)) 0 0;
        font-size: var(--fs-xs);
        color: var(--color-accent);
      }
      .gf__chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .gf__chip {
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill, 999px);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .gf__chip--on {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: var(--color-on-accent, #fff);
      }
      .gf__error {
        color: var(--color-danger);
        margin: 0;
        font-size: var(--fs-sm);
      }
    `,
  ],
})
export class GoalFormModalComponent {
  private readonly _data = inject<GoalFormData>(MAT_DIALOG_DATA);
  private readonly _ref = inject<MatDialogRef<GoalFormModalComponent, GoalFormResult | null>>(
    MatDialogRef,
  );
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);

  /** Режим редактирования. */
  protected readonly isEdit = this._data.goal !== undefined;
  /** Роды цели (для select). */
  protected readonly directions = DIRECTIONS;
  /** Каталог сфер. */
  protected readonly domains = signal<AccentRefItem[]>([]);
  /** Каталог RPG-атрибутов. */
  protected readonly attributesCatalog = signal<AccentRefItem[]>([]);
  /** Кандидаты в родители (активные цели, кроме себя). */
  protected readonly parents = signal<GoalProgressView[]>([]);
  /** Выбранные атрибуты. */
  protected readonly attrs = signal<Set<string>>(new Set(this._data.goal?.attributes ?? []));
  /** Отправлено (для показа ошибок). */
  protected readonly submitted = signal(false);
  /** Общая ошибка формы (для редких неполевых случаев). */
  protected readonly formError = signal<string | null>(null);
  /** Идёт сохранение (форма сама зовёт API) — кнопка заблокирована, ввод сохранён (H#B2-9). */
  protected readonly busy = signal(false);
  /** Инлайн-ошибка у поля «Цель/Верхняя граница». */
  protected readonly targetError = signal<string | null>(null);
  /** Инлайн-ошибка у поля «Старт/Нижняя граница». */
  protected readonly startError = signal<string | null>(null);

  /** Реактивная форма. */
  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    whyItMatters: new FormControl('', { nonNullable: true }),
    direction: new FormControl<GoalDirection>('accumulate', { nonNullable: true }),
    unit: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(32)],
    }),
    targetValue: new FormControl<number | null>(null, { validators: [Validators.required] }),
    startValue: new FormControl<number | null>(null),
    deadline: new FormControl<string | null>(null),
    domainKey: new FormControl<string | null>(null),
    parentGoalId: new FormControl<string | null>(null),
    fallbackVersion: new FormControl('', { nonNullable: true }),
    tradeoff: new FormControl('', { nonNullable: true }),
  });

  /** Текущий род (сигнал — обновляется из valueChanges, чтобы showStart/isAccumulate были реактивны). */
  private readonly _direction = signal<GoalDirection>('accumulate');
  /** Показывать ли поле «старт» (reach/reduce). */
  protected readonly showStart = computed(() => this._direction() !== 'accumulate');
  /** Накопительная цель? — для mission-подсказки и поля «ради чего откажусь» (ADR-0053). */
  protected readonly isAccumulate = computed(() => this._direction() === 'accumulate');
  /** Удерживать-цель? — для подписей границ коридора (ADR-0052, maintain). */
  protected readonly isMaintain = computed(() => this._direction() === 'maintain');

  /** Показывать ли выбор родителя (не edit и не предзадан). */
  protected readonly showParentSelect = (): boolean =>
    !this.isEdit && this._data.presetParentId === undefined;

  public constructor() {
    const goal = this._data.goal;
    if (goal) {
      this.form.patchValue({
        title: goal.title,
        whyItMatters: goal.whyItMatters ?? '',
        direction: goal.direction,
        unit: goal.unit,
        targetValue: goal.targetValue,
        startValue: goal.startValue,
        deadline: goal.deadline,
        domainKey: goal.domainKey,
        fallbackVersion: goal.fallbackVersion ?? '',
        tradeoff: goal.tradeoff ?? '',
      });
      this.form.controls.direction.disable();
      this.form.controls.startValue.disable();
    }
    if (this._data.presetParentId !== undefined) {
      this.form.controls.parentGoalId.setValue(this._data.presetParentId);
    }
    // Реактивно отслеживаем род (для showStart/isAccumulate).
    this._direction.set(this.form.controls.direction.value);
    this.form.controls.direction.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((d) => { this._direction.set(d); });
    this._api.listDomains().subscribe({ next: (d) => { this.domains.set(d); }, error: () => undefined });
    this._api
      .listAttributes()
      .subscribe({ next: (a) => { this.attributesCatalog.set(a); }, error: () => undefined });
    if (this.showParentSelect()) {
      this._api.listGoals('active').subscribe({
        next: (g) => { this.parents.set(g); },
        error: () => undefined,
      });
    }
  }

  /** Ошибка названия (если тронуто/отправлено). */
  protected titleError(): string | null {
    const c = this.form.controls.title;
    if ((!c.touched && !this.submitted()) || c.valid) {
      return null;
    }
    return 'Название обязательно.';
  }

  /** Ошибка единицы. */
  protected unitError(): string | null {
    const c = this.form.controls.unit;
    if ((!c.touched && !this.submitted()) || c.valid) {
      return null;
    }
    return 'Единица обязательна.';
  }

  /** RU-подпись рода. */
  protected directionLabel(direction: GoalDirection): string {
    return GOAL_DIRECTION_LABELS[direction];
  }

  /** Подсказка по выбранному роду. */
  protected directionHint(): string {
    return GOAL_DIRECTION_DESCRIPTIONS[this.form.controls.direction.value];
  }

  /** Переключает атрибут. */
  protected toggleAttr(key: string): void {
    this.attrs.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /** Открывает контекстный мини-гид «что это?» по полю (вложенный диалог; ввод не теряется). */
  protected openGuide(key: string): void {
    const data = GOAL_FIELD_GUIDES[key];
    if (data === undefined) {
      return;
    }
    this._dialog.open(FieldGuideModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      data,
    });
  }

  /** Сохраняет — валидирует, собирает payload, зовёт API; закрывается лишь при успехе. */
  protected save(): void {
    if (this.busy()) {
      return;
    }
    this.submitted.set(true);
    this.formError.set(null);
    this.targetError.set(null);
    this.startError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const target = v.targetValue;
    if (target === null || !Number.isFinite(target)) {
      this.targetError.set('Укажи целевое значение числом.');
      return;
    }
    if (v.direction === 'accumulate' && target <= 0) {
      this.targetError.set('Для «накопить» должно быть больше 0.');
      return;
    }
    if (v.direction === 'maintain') {
      if (v.startValue === null || !Number.isFinite(v.startValue)) {
        this.startError.set('Укажи нижнюю границу коридора.');
        return;
      }
      if (v.startValue >= target) {
        this.startError.set('Нижняя граница должна быть меньше верхней.');
        return;
      }
    } else if (v.direction !== 'accumulate' && v.startValue !== null && target === v.startValue) {
      this.targetError.set('Цель должна отличаться от старта.');
      return;
    }
    const trimmedWhy = v.whyItMatters.trim();
    const trimmedFallback = v.fallbackVersion.trim();
    const trimmedTradeoff = v.tradeoff.trim();
    const attributes = [...this.attrs()];

    if (this.isEdit) {
      const payload: GoalUpdatePayload = {
        title: v.title.trim(),
        whyItMatters: trimmedWhy === '' ? null : trimmedWhy,
        domainKey: v.domainKey,
        attributes,
        unit: v.unit.trim(),
        targetValue: target,
        deadline: v.deadline === '' ? null : v.deadline,
        fallbackVersion: trimmedFallback === '' ? null : trimmedFallback,
        tradeoff: trimmedTradeoff === '' ? null : trimmedTradeoff,
      };
      this._submit({ mode: 'update', payload });
      return;
    }
    const payload: GoalPayload = {
      title: v.title.trim(),
      direction: v.direction,
      unit: v.unit.trim(),
      targetValue: target,
      parentGoalId: v.parentGoalId,
      whyItMatters: trimmedWhy === '' ? null : trimmedWhy,
      domainKey: v.domainKey,
      attributes,
      startValue: v.startValue,
      deadline: v.deadline === '' ? null : v.deadline,
      fallbackVersion: trimmedFallback === '' ? null : trimmedFallback,
      tradeoff: trimmedTradeoff === '' ? null : trimmedTradeoff,
    };
    this._submit({ mode: 'create', payload });
  }

  /**
   * Зовёт сохранение через `data.submit` (форма владеет вызовом API): при успехе закрывает с
   * результатом, при ошибке — оставляет форму открытой и показывает текст ошибки (H#B2-9). Без
   * `submit` (страховка) — старое поведение: просто закрыть с результатом.
   */
  private _submit(result: GoalFormResult): void {
    const run = this._data.submit;
    if (run === undefined) {
      this._ref.close(result);
      return;
    }
    this.busy.set(true);
    run(result)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this._ref.close(result),
        error: (err: unknown) => this.formError.set(errorMessage(err)),
      });
  }

  /** Отмена. */
  protected cancel(): void {
    this._ref.close(null);
  }
}
