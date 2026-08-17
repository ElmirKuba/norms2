import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/** Данные, с которыми открывают календарь. */
export interface DayPickerData {
  /** Выбранный день `YYYY-MM-DD`. */
  selected: string;
  /** Сегодня `YYYY-MM-DD` по поясу аккаунта. */
  today: string;
  /** Дни, в которые что-то есть, — только они и кликаются. */
  daysWithContent: readonly string[];
}

/** Одна клетка сетки: либо день, либо пустое место до начала месяца. */
interface DayCell {
  /** Дата `YYYY-MM-DD`; `null` — заполнитель. */
  date: string | null;
  /** Число месяца. */
  day: number;
  /** Есть ли записи — клетка кликабельна. */
  hasContent: boolean;
  /** Сегодняшний день. */
  isToday: boolean;
  /** Выбранный сейчас. */
  isSelected: boolean;
  /** Будущее — закрыто (2.10·B1). */
  isFuture: boolean;
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

/**
 * Календарь выбора дня (2.10·B3, переработка по замечанию Elmir 17.08.2026).
 *
 * **Почему календарь, а не стрелки.** Стрелками «предыдущий день с записями» человек ходит вслепую:
 * он не видит, сколько дней позади, где в истории дыры и есть ли вообще смысл нажимать. Вопрос
 * «что у меня было на прошлой неделе» стрелками решается перебором, а календарём — одним взглядом.
 *
 * **Кликается не всё.** Дни без записей серые и не нажимаются: попасть в пустой день — значит
 * получить экран «ничего нет» и не понять, это сбой или так и было. Будущее закрыто тем же
 * правилом, что и на бэке: продукт не показывает то, чего ещё не случилось.
 *
 * Стрелки листают **месяцы**, а не дни: шаг календаря — месяц, иначе сетка живёт своей жизнью.
 */
@Component({
  selector: 'app-day-picker-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>Выбрать день</h2>
      </div>

      <div class="dlg__body">
        <div class="cal__nav">
          <button
            type="button"
            class="cal__arrow"
            (click)="shiftMonth(-1)"
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
          <span class="cal__month">{{ monthLabel() }}</span>
          <button
            type="button"
            class="cal__arrow"
            (click)="shiftMonth(1)"
            [disabled]="atCurrentMonth()"
            aria-label="Следующий месяц"
          >
            ›
          </button>
        </div>

        <div class="cal__grid cal__grid--head" aria-hidden="true">
          @for (name of weekdays; track name) {
            <span class="cal__wd">{{ name }}</span>
          }
        </div>

        <div class="cal__grid" role="grid">
          @for (cell of cells(); track $index) {
            @if (cell.date === null) {
              <span class="cal__cell cal__cell--empty"></span>
            } @else {
              <button
                type="button"
                class="cal__cell"
                [class.cal__cell--has]="cell.hasContent"
                [class.cal__cell--today]="cell.isToday"
                [class.cal__cell--selected]="cell.isSelected"
                [disabled]="!cell.hasContent && !cell.isToday"
                [attr.aria-current]="cell.isToday ? 'date' : null"
                (click)="pick(cell)"
              >
                {{ cell.day }}
              </button>
            }
          }
        </div>

        <p class="cal__legend">
          Открываются только дни, в которые что-то было. Сегодня открыт всегда; будущее закрыто —
          отмечать заранее нечего.
        </p>
      </div>

      <div class="dlg__foot">
        <app-button variant="ghost" (click)="close()">Закрыть</app-button>
        <app-button (click)="pickToday()">Сегодня</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .dlg__head h2 {
        margin: 0;
        font-size: var(--fs-lg);
      }

      .dlg__body {
        padding: var(--space-4) 0;
      }

      /* Глобальный стиль футера прижимает кнопки вправо; здесь «Закрыть» слева, «Сегодня»
         справа — быстрый возврат не должен теряться рядом с отменой. */
      .dlg__foot {
        justify-content: space-between;
      }

      .cal__nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
      }

      .cal__month {
        flex: 1;
        text-align: center;
        font-weight: var(--fw-medium);
        text-transform: capitalize;
      }

      .cal__arrow {
        width: 32px;
        height: 32px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text);
        font-size: var(--fs-lg);
        line-height: 1;
        cursor: pointer;
      }

      .cal__arrow:disabled {
        opacity: 0.35;
        cursor: default;
      }

      .cal__grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }

      .cal__grid--head {
        margin-bottom: 4px;
      }

      .cal__wd {
        text-align: center;
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }

      .cal__cell {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
        cursor: default;
      }

      /* Есть записи — клетка выглядит нажимаемой: заливка + обычный цвет текста. */
      .cal__cell--has {
        background: var(--color-surface-2, var(--color-surface));
        border-color: var(--color-border);
        color: var(--color-text);
        cursor: pointer;
      }

      .cal__cell--has:hover {
        border-color: var(--color-accent);
      }

      .cal__cell--today {
        color: var(--color-accent);
        font-weight: var(--fw-medium);
        cursor: pointer;
      }

      .cal__cell--selected {
        border-color: var(--color-accent);
        background: var(--color-accent);
        color: var(--color-bg);
      }

      .cal__cell--empty {
        border: none;
      }

      .cal__legend {
        margin: var(--space-4) 0 0;
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class DayPickerModalComponent {
  private readonly _ref = inject<MatDialogRef<DayPickerModalComponent, string>>(MatDialogRef);
  private readonly _data = inject<DayPickerData>(MAT_DIALOG_DATA);

  /** Подписи дней недели, неделя начинается с понедельника. */
  protected readonly weekdays = WEEKDAYS;

  /** Показываемый месяц: первое число, `YYYY-MM`. */
  protected readonly month = signal(this._data.selected.slice(0, 7));

  /** Дни с записями — множество для быстрой проверки. */
  private readonly _content = new Set(this._data.daysWithContent);

  /** Подпись месяца («август 2026»). */
  protected readonly monthLabel = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    // Месяц и год склеиваем сами: `year: 'numeric'` в русской локали добавляет «г.» — в заголовке
    // календаря это лишний шум.
    const name = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(
      new Date(year ?? 2026, (month ?? 1) - 1, 1),
    );
    return `${name} ${year ?? ''}`;
  });

  /** Дошли ли до текущего месяца — дальше листать некуда. */
  protected readonly atCurrentMonth = computed(() => this.month() >= this._data.today.slice(0, 7));

  /** Сетка месяца: заполнители до первого дня + сами дни. */
  protected readonly cells = computed<DayCell[]>(() => {
    const [year, month] = this.month().split('-').map(Number);
    const y = year ?? 2026;
    const m = month ?? 1;
    const first = new Date(y, m - 1, 1);
    // getDay(): вс = 0, а неделя у нас с понедельника.
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(y, m, 0).getDate();
    const cells: DayCell[] = [];
    for (let i = 0; i < lead; i += 1) {
      cells.push({
        date: null,
        day: 0,
        hasContent: false,
        isToday: false,
        isSelected: false,
        isFuture: false,
      });
    }
    for (let day = 1; day <= total; day += 1) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        date,
        day,
        hasContent: this._content.has(date) && date <= this._data.today,
        isToday: date === this._data.today,
        isSelected: date === this._data.selected,
        isFuture: date > this._data.today,
      });
    }
    return cells;
  });

  /**
   * Листает месяц.
   * @param direction −1 назад, +1 вперёд.
   * @returns Ничего.
   */
  protected shiftMonth(direction: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const shifted = new Date(year ?? 2026, (month ?? 1) - 1 + direction, 1);
    const next = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
    if (next > this._data.today.slice(0, 7)) {
      return;
    }
    this.month.set(next);
  }

  /**
   * Выбирает день и закрывает окно.
   * @param cell Клетка календаря.
   * @returns Ничего.
   */
  protected pick(cell: DayCell): void {
    if (cell.date === null || (!cell.hasContent && !cell.isToday)) {
      return;
    }
    this._ref.close(cell.date);
  }

  /**
   * Возвращает к сегодняшнему дню.
   * @returns Ничего.
   */
  protected pickToday(): void {
    this._ref.close(this._data.today);
  }

  /**
   * Закрывает без выбора.
   * @returns Ничего.
   */
  protected close(): void {
    this._ref.close();
  }
}
