import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { NumberFieldComponent } from '../../../shared/ui/number-field/number-field.component';
import { HscrollHintDirective } from '../../../shared/ui/hscroll-hint.directive';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { HABIT_KIND_DESCRIPTIONS, HABIT_KIND_LABELS } from '../accent.types';
import type { AccentRefItem, HabitKind, HabitPayload, HabitView, LadderPolicy } from '../accent.types';
import {
  RECURRENCE_MODE_DESCRIPTIONS,
  WEEKDAY_CODES,
  WEEKDAY_LABELS,
  buildRecurrence,
  parseRecurrence,
} from './recurrence-builder.util';
import type { RecurrenceMode } from './recurrence-builder.util';
import { FieldGuideModalComponent } from '../field-guide-modal.component';
import type { FieldGuideData } from '../field-guide-modal.component';

/** Данные в модалку: если `habit` задан — режим редактирования. */
export interface HabitFormData {
  /** Редактируемая привычка (или undefined — создание). */
  habit?: HabitView;
  /**
   * Сохранение: форма САМА зовёт API и закрывается лишь при успехе; при ошибке остаётся
   * открытой с текстом ошибки — ввод не теряется (H#B2-9).
   */
  submit?: (payload: HabitPayload) => Observable<unknown>;
}

/**
 * Курируемый набор эмодзи для пикера иконки привычки — вместо свободного ввода
 * (исключает мусор-строки в карточке). Тело/движение, ум, самочувствие, быт, настроение,
 * связи, природа, фокус.
 */
const ICON_OPTIONS: readonly string[] = [
  '💪', '🏃', '🧘', '🚶', '🏋️', '🚴', '⚽', '🤸',
  '💧', '🥗', '🍎', '😴', '🛏️', '🚿', '💊', '🦷',
  '📖', '📚', '✍️', '🧠', '💡', '🎯', '⏰', '✅',
  '🌅', '🌙', '🧹', '🌱', '🌿', '☀️',
  '🎨', '🎵', '🎸', '💻', '💰', '🙏', '❤️', '😊', '🤝', '📵', '🔥',
];

/**
 * Контекстные мини-гиды «что это?» по полям формы привычки (заменяют одну большую
 * справку-простыню — объясняем точечно). Открываются общим `FieldGuideModalComponent`.
 * Тексты — просто, по-человечески ([[ui-copy-plain-simple]]).
 */
const HABIT_FIELD_GUIDES: Record<string, FieldGuideData> = {
  title: {
    title: 'Название привычки',
    paragraphs: [
      'Что именно делаешь, коротко и конкретно: «Отжимания», «Стакан воды утром», «10 страниц».',
      'Чем конкретнее, тем легче понять, сделал ты сегодня или нет. «Спорт» — размыто, «10 приседаний» — ясно.',
    ],
  },
  icon: {
    title: 'Иконка',
    paragraphs: [
      'Необязательный значок, чтобы быстро узнавать привычку в списке глазами.',
      'Чисто для удобства, на механику не влияет. Не хочешь — оставь без иконки.',
    ],
  },
  description: {
    title: 'Описание',
    paragraphs: [
      'Короткая заметка «зачем тебе это». Необязательно.',
      'В трудный день напомнит будущему тебе, ради чего привычка вообще нужна.',
    ],
  },
  kind: {
    title: 'Тип привычки',
    paragraphs: ['От типа зависит, что отмечаешь в задаче на сегодня — галочку, число или секунды:'],
    bullets: [
      { term: 'Сделал / не сделал', desc: 'простая галочка: зарядка была или нет.' },
      { term: 'Число', desc: 'считаешь количество: отжимания, страницы.' },
      { term: 'Время', desc: 'засекаешь длительность: планка, медитация.' },
    ],
  },
  recurrence: {
    title: 'Повтор',
    paragraphs: [
      'Как часто привычка появляется задачей: каждый день, по будням, по выбранным дням недели или раз в N дней.',
      'Задачи на вкладке «Сегодня» создаются по этому расписанию автоматически.',
    ],
  },
  ladder: {
    title: 'Лесенка',
    paragraphs: ['Чтобы не сгореть: план начинается с минимума и постепенно растёт к цели.'],
    bullets: [
      { term: 'Минимум', desc: 'нижняя планка — что не стыдно даже в худший день.' },
      { term: 'Сейчас', desc: 'текущая норма на сегодня.' },
      { term: 'Цель', desc: 'куда идёшь (необязательно).' },
      { term: 'Адаптивно', desc: 'планка сама растёт, когда легко, и отступает, когда тяжело.' },
      { term: 'Вручную', desc: 'меняешь уровень сам.' },
    ],
  },
  domain: {
    title: 'Сфера',
    paragraphs: [
      'Область жизни, к которой относится привычка (здоровье, работа, отношения…). Необязательно.',
      'Помогает потом видеть баланс — не ушла ли вся энергия в одну сторону.',
    ],
  },
  goal: {
    title: 'Вклад в цель',
    paragraphs: [
      'Если есть накопительная цель (например, «прочитать 50 книг»), выполнение привычки будет добавлять в неё прогресс.',
      'Необязательно. Поле появляется, только если у тебя есть активные накопительные цели.',
    ],
  },
  attributes: {
    title: 'Атрибуты',
    paragraphs: [
      'Как в RPG: дело прокачивает характеристику (силу, дисциплину, фокус…). Необязательно.',
      'Чисто для наглядного «роста персонажа». Не уверен — пропусти.',
    ],
  },
  minVersion: {
    title: 'Минимум на плохой день',
    paragraphs: [
      'Самая урезанная версия привычки на день, когда совсем нет сил: «1 отжимание» вместо полной тренировки.',
      'Смысл — не обнулить серию. Сделал хоть микро-версию — день засчитан, привычка жива.',
    ],
  },
};

/** Сегодняшняя локальная дата в формате `YYYY-MM-DD` (дефолт для «начать не сегодня»). */
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Модалка создания/редактирования привычки (MatDialog, ADR-0026) — ядро (2.4·16a):
 * название/иконка/описание/тип + пикер расписания (RRULE-пресеты) + лесенка
 * (min·current·goal·step·policy; для binary авто 1/1) + minVersion. Сфера/атрибуты — ·16b.
 * Справка — контекстные «что это?» по полям (`FieldGuideModalComponent`), без простыни.
 * Закрывается с `HabitPayload` (сохранить) или `null` (отмена).
 */
@Component({
  selector: 'app-habit-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, NumberFieldComponent, HscrollHintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>{{ isEdit ? 'Изменить привычку' : 'Новая привычка' }}</h2>
      </div>

      <form class="dlg__form" [formGroup]="form" (ngSubmit)="save()">
        <div class="dlg__body hf__fields">
        <label class="hf__field">
          <span class="hf__label">
            Название <span class="hf__req">*</span>
            <button type="button" class="hf__help" (click)="openGuide('title')">что это?</button>
          </span>
          <input class="hf__input" type="text" maxlength="120" formControlName="title" placeholder="Напр. Отжимания" />
          @if (titleError()) {
            <span class="hf__error">{{ titleError() }}</span>
          }
        </label>

        <div class="hf__field">
          <span class="hf__label">
            Иконка <span class="hf__opt">(необязательно)</span>
            <button type="button" class="hf__help" (click)="openGuide('icon')">что это?</button>
          </span>
          <div class="hf__icons" appHscrollHint>
            <button
              type="button"
              class="hf__icon-opt hf__icon-opt--none"
              [class.active]="iconValue() === ''"
              (click)="selectIcon('')"
              aria-label="Без иконки"
            >✕</button>
            @for (e of iconOptions; track e) {
              <button
                type="button"
                class="hf__icon-opt"
                [class.active]="iconValue() === e"
                (click)="selectIcon(e)"
              >{{ e }}</button>
            }
          </div>
        </div>

        <label class="hf__field">
          <span class="hf__label">
            Описание
            <button type="button" class="hf__help" (click)="openGuide('description')">что это?</button>
          </span>
          <input class="hf__input" type="text" formControlName="description" placeholder="Коротко зачем" />
        </label>

        <label class="hf__field">
          <span class="hf__label">
            Тип
            <button type="button" class="hf__help" (click)="openGuide('kind')">что это?</button>
          </span>
          <select class="hf__input" formControlName="kind">
            @for (k of kinds; track k.value) {
              <option [ngValue]="k.value">{{ k.label }}</option>
            }
          </select>
          <span class="hf__hint">{{ kindHint() }}</span>
        </label>

        <label class="hf__field">
          <span class="hf__label">
            Повтор
            <button type="button" class="hf__help" (click)="openGuide('recurrence')">что это?</button>
          </span>
          <select class="hf__input" formControlName="recurrenceMode">
            <option [ngValue]="'daily'">Каждый день</option>
            <option [ngValue]="'weekdays'">По будням (Пн–Пт)</option>
            <option [ngValue]="'custom-week'">По дням недели</option>
            <option [ngValue]="'every-n'">Каждые N дней</option>
          </select>
          <span class="hf__hint">{{ modeHint() }}</span>
        </label>

        @if (showCustomWeek()) {
          <div class="hf__weekdays" appHscrollHint>
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
            <app-number-field formControlName="intervalN" [min]="2" label="Каждые N дней" />
          </label>
        }

        <label class="hf__check">
          <input type="checkbox" formControlName="startNotToday" />
          <span>Начать не сегодня?</span>
        </label>
        @if (showStartPicker()) {
          <label class="hf__field">
            <span class="hf__label">Начать с</span>
            <input class="hf__input" type="date" formControlName="startDate" />
            <span class="hf__hint">
              С этого дня пойдёт отсчёт расписания. Для «каждые N дней» сдвиг на день ставит
              две привычки в противофазу — они чередуются.
            </span>
          </label>
        }

        @if (isQuantitative()) {
          <div class="hf__ladder">
            <span class="hf__label">
              Лесенка (план растёт от минимума к цели)
              <button type="button" class="hf__help" (click)="openGuide('ladder')">что это?</button>
            </span>
            <span class="hf__hint">
              Минимум — что не стыдно даже в худший день. «Адаптивно» = планка сама растёт, когда
              легко, и отступает, когда тяжело.
            </span>
            <div class="hf__row">
              <label class="hf__field">
                <span class="hf__sub">Минимум</span>
                <app-number-field formControlName="minTarget" [min]="1" label="Минимум" />
              </label>
              <label class="hf__field">
                <span class="hf__sub">Сейчас</span>
                <app-number-field formControlName="currentTarget" [min]="1" label="Сейчас" />
              </label>
              <label class="hf__field">
                <span class="hf__sub">Цель (опц.)</span>
                <app-number-field formControlName="goalTarget" [min]="1" label="Цель (опц.)" />
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
                  <app-number-field formControlName="step" [min]="1" label="Шаг" />
                </label>
              }
            </div>
          </div>
        }

        @if (isTimed()) {
          <label class="hf__field">
            <span class="hf__label">Подготовка перед таймером <span class="hf__opt">(опц., сек)</span></span>
            <app-number-field formControlName="prepSeconds" [min]="0" [max]="3600" placeholder="напр. 5" label="Подготовка (сек)" />
            <span class="hf__hint">Обратный отсчёт «приготовься» перед стартом. Пусто — без подготовки.</span>
          </label>
        }

        <label class="hf__field">
          <span class="hf__label">
            Сфера <span class="hf__opt">(опц.)</span>
            <button type="button" class="hf__help" (click)="openGuide('domain')">что это?</button>
          </span>
          <select class="hf__input" formControlName="domainKey">
            <option [ngValue]="null">— не выбрана —</option>
            @for (d of domains(); track d.key) {
              <option [ngValue]="d.key">{{ d.title }}</option>
            }
          </select>
        </label>

        @if (goalsForLink().length > 0) {
          <label class="hf__field">
            <span class="hf__label">
              Вклад в цель <span class="hf__opt">(опц.)</span>
              <button type="button" class="hf__help" (click)="openGuide('goal')">что это?</button>
            </span>
            <select class="hf__input" formControlName="goalId">
              <option [ngValue]="null">— не привязана —</option>
              @for (g of goalsForLink(); track g.id) {
                <option [ngValue]="g.id">{{ g.title }}</option>
              }
            </select>
            <span class="hf__hint">Выполнение привычки будет добавлять прогресс в эту накопительную цель.</span>
          </label>
        }

        @if (attributesCatalog().length > 0) {
          <div class="hf__field">
            <span class="hf__label">
              Прокачивает атрибуты <span class="hf__opt">(опц.)</span>
              <button type="button" class="hf__help" (click)="openGuide('attributes')">что это?</button>
            </span>
            <span class="hf__hint">Как в RPG: дело качает характеристику. Не уверен — пропусти.</span>
            <div class="hf__chips" appHscrollHint>
              @for (a of attributesCatalog(); track a.key) {
                <button
                  type="button"
                  class="hf__chip"
                  [class.active]="attrs().has(a.key)"
                  (click)="toggleAttr(a.key)"
                >
                  {{ a.title }}
                </button>
              }
            </div>
          </div>
        }

        <label class="hf__field">
          <span class="hf__label">
            Минимум на плохой день <span class="hf__opt">(опц.)</span>
            <button type="button" class="hf__help" (click)="openGuide('minVersion')">что это?</button>
          </span>
          <input class="hf__input" type="text" formControlName="minVersion" />
        </label>

        @if (formError()) {
          <span class="hf__error">{{ formError() }}</span>
        }
        </div>

        <div class="dlg__foot">
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
          <app-button type="submit" [loading]="busy()">Сохранить</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .hf__help {
        margin-left: var(--space-2);
        padding: 0;
        background: none;
        border: none;
        cursor: pointer;
        font-size: var(--fs-xs);
        color: var(--color-accent);
        text-decoration: underline;
      }
      .hf__hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .hf__fields {
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
      .hf__req {
        color: var(--color-danger);
      }
      .hf__opt {
        font-size: var(--fs-xs);
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
      .hf__check {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hf__check input {
        width: auto;
        min-height: 0;
        cursor: pointer;
      }
      .hf__ladder {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-surface-2);
        border-radius: var(--radius-md);
      }
      // Чипсы (дни недели / атрибуты) — на узком экране не переносим, а скроллим
      // горизонтально (полоса скрыта; нудж-подсказка — appHscrollHint).
      .hf__weekdays,
      .hf__chips,
      .hf__icons {
        display: flex;
        gap: var(--space-2);
        flex-wrap: nowrap;
        overflow-x: auto;
        scroll-behavior: smooth;
        scrollbar-width: none;
        -ms-overflow-style: none;
        // overflow делает авто-min-height = 0 → в flex-колонке модалки (скролл-контейнер
        // с ограниченной высотой) прямой ряд схлопывался в 0. Не даём колонке сжать.
        flex-shrink: 0;
      }
      .hf__weekdays::-webkit-scrollbar,
      .hf__chips::-webkit-scrollbar,
      .hf__icons::-webkit-scrollbar {
        display: none;
      }
      .hf__icon-opt {
        flex-shrink: 0;
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        font-size: var(--fs-lg);
        line-height: 1;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        cursor: pointer;
      }
      .hf__icon-opt.active {
        border-color: var(--color-accent);
        background: var(--color-surface);
      }
      .hf__icon-opt--none {
        color: var(--color-text-muted);
      }
      .hf__day {
        flex-shrink: 0;
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
      .hf__chip {
        flex-shrink: 0;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text-muted);
        cursor: pointer;
      }
      .hf__chip.active {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }
      .hf__error {
        font-size: var(--fs-sm);
        color: var(--color-danger);
      }
    `,
  ],
})
export class HabitFormModalComponent {
  private readonly _ref =
    inject<MatDialogRef<HabitFormModalComponent, HabitPayload | null>>(MatDialogRef);
  private readonly _data = inject<HabitFormData>(MAT_DIALOG_DATA);
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);

  /** Каталог сфер (для select). */
  protected readonly domains = signal<AccentRefItem[]>([]);
  /** Каталог RPG-атрибутов (для мультиселекта). */
  protected readonly attributesCatalog = signal<AccentRefItem[]>([]);
  /** Выбранные ключи атрибутов. */
  protected readonly attrs = signal<Set<string>>(new Set());
  /** Активные накопительные цели — для привязки (прогресс цели от выполнения, 2.5·13). */
  protected readonly goalsForLink = signal<Array<{ id: string; title: string }>>([]);

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
  /** Идёт сохранение (форма сама зовёт API) — кнопка заблокирована, ввод сохранён (H#B2-9). */
  protected readonly busy = signal(false);

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
    domainKey: new FormControl<string | null>(null),
    goalId: new FormControl<string | null>(null),
    minVersion: new FormControl('', { nonNullable: true }),
    // Время подготовки перед таймером (сек), только для timed (опц., FEAT-H1).
    prepSeconds: new FormControl<number | null>(null),
    // «Начать не сегодня»: якорь расписания (BUG-2). Выкл → старт с даты создания;
    // вкл → с выбранной даты (для «каждые N дней» сдвиг даёт чередование в противофазе).
    startNotToday: new FormControl(false, { nonNullable: true }),
    startDate: new FormControl(todayYmd(), { nonNullable: true }),
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
  private readonly _startNotToday = toSignal(this.form.controls.startNotToday.valueChanges, {
    initialValue: this.form.controls.startNotToday.value,
  });
  /** Текущее значение иконки (для подсветки выбранной в пикере). */
  protected readonly iconValue = toSignal(this.form.controls.icon.valueChanges, {
    initialValue: this.form.controls.icon.value,
  });
  /** Курируемый набор эмодзи для пикера иконки. */
  protected readonly iconOptions = ICON_OPTIONS;

  /** Выбирает иконку (пустая строка — без иконки). */
  protected selectIcon(emoji: string): void {
    this.form.controls.icon.setValue(emoji);
  }

  /** Показывать ли поля лесенки (не binary). */
  protected readonly isQuantitative = computed(() => this._kind() !== 'binary');
  protected readonly isTimed = computed(() => this._kind() === 'timed');
  /** Адаптивная ли политика (показ шага). */
  protected readonly isAdaptive = computed(() => this._policy() === 'adaptive');
  /** Показывать ли выбор дней недели. */
  protected readonly showCustomWeek = computed(() => this._mode() === 'custom-week');
  /** Показывать ли интервал. */
  protected readonly showInterval = computed(() => this._mode() === 'every-n');
  /** Показывать ли выбор даты старта (галка «начать не сегодня» включена). */
  protected readonly showStartPicker = computed(() => this._startNotToday());
  /** Подсказка по выбранному типу. */
  protected readonly kindHint = computed(() => HABIT_KIND_DESCRIPTIONS[this._kind()]);
  /** Подсказка по выбранному режиму расписания. */
  protected readonly modeHint = computed(() => RECURRENCE_MODE_DESCRIPTIONS[this._mode()]);

  public constructor() {
    this._api.listDomains().subscribe({ next: (d) => this.domains.set(d), error: () => undefined });
    this._api.listAttributes().subscribe({
      next: (a) => this.attributesCatalog.set(a),
      error: () => undefined,
    });
    // Только накопительные цели — прогресс от привычки осмыслен лишь для accumulate (2.5·13).
    this._api.listGoals('active').subscribe({
      next: (goals) =>
        this.goalsForLink.set(
          goals.filter((g) => g.direction === 'accumulate').map((g) => ({ id: g.id, title: g.title })),
        ),
      error: () => undefined,
    });
    const habit = this._data.habit;
    if (habit !== undefined) {
      const rec = parseRecurrence(habit.recurrence);
      this.weekdays.set(new Set(rec.weekdays));
      this.attrs.set(new Set(habit.attributes));
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
        domainKey: habit.domainKey,
        goalId: habit.goalId,
        minVersion: habit.minVersion ?? '',
        prepSeconds: habit.prepSeconds ?? null,
        startNotToday: habit.startDate !== null,
        startDate: habit.startDate ?? todayYmd(),
      });
    }
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

  /** Переключает выбор атрибута. */
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

  /** Сохраняет — собирает payload (recurrence + ladder), зовёт API; закрывается лишь при успехе. */
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
      // Якорь расписания только если явно «начать не сегодня»; иначе null → бэк берёт дату создания.
      startDate: v.startNotToday ? v.startDate : null,
      ladder,
      description: v.description.trim() === '' ? null : v.description.trim(),
      icon: v.icon.trim() === '' ? null : v.icon.trim(),
      domainKey: v.domainKey,
      goalId: v.goalId,
      attributes: [...this.attrs()],
      minVersion: v.minVersion.trim() === '' ? null : v.minVersion.trim(),
      // Подготовка — только для timed и только положительная; иначе null.
      prepSeconds: v.kind === 'timed' && v.prepSeconds !== null && v.prepSeconds > 0 ? v.prepSeconds : null,
    };
    this._submit(payload);
  }

  /**
   * Зовёт сохранение через `data.submit` (форма владеет вызовом API): при успехе закрывает с
   * payload, при ошибке — оставляет форму открытой и показывает текст ошибки (H#B2-9). Без
   * `submit` (страховка) — старое поведение: просто закрыть с payload.
   */
  private _submit(payload: HabitPayload): void {
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

  /** Открывает контекстный мини-гид «что это?» по полю (вложенный диалог; ввод не теряется). */
  protected openGuide(key: string): void {
    const data = HABIT_FIELD_GUIDES[key];
    if (data === undefined) {
      return;
    }
    this._dialog.open(FieldGuideModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      data,
    });
  }
}
