import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { formatDay } from './format-day.util';
import type { TodoEventView } from '../accent.types';

/**
 * Справочник событий, которых ждут дела (2.10·D2).
 *
 * **Почему справочник, а не строка в записи.** Одного события ждут сразу несколько дел: «приедет
 * сварщик 27.08» держит и перенос батареи, и переварку труб, и покупку кронштейна. Держи это
 * текстом в каждой записи — и при переносе даты пришлось бы править три места, а разошлись бы
 * они молча.
 *
 * **Состоявшееся событие не удаляется, а отмечается** — и все ждавшие его дела освобождаются
 * разом. Модалка показывает, сколько именно освободилось: человек должен видеть следствие
 * действия, а не догадываться о нём.
 */
@Component({
  selector: 'app-todo-events-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>Чего ждём</h2>
      </div>

      <div class="dlg__body ev__body">
        <form class="ev__new" (submit)="create($event)">
          <input
            class="ev__input"
            type="text"
            [value]="draftTitle()"
            (input)="draftTitle($any($event.target).value)"
            placeholder="Например: приедет сварщик"
            aria-label="Название события"
            maxlength="200"
          />
          <input
            class="ev__input ev__input--date"
            type="date"
            [value]="draftDate()"
            (input)="draftDate($any($event.target).value)"
            aria-label="Ожидаемая дата"
          />
          <app-button type="submit" [disabled]="draftTitle().trim() === ''">Добавить</app-button>
        </form>

        @if (message()) {
          <p class="ev__message" role="status">{{ message() }}</p>
        }
        @if (error()) {
          <p class="ev__error" role="alert">{{ error() }}</p>
        }

        @if (loading()) {
          <p class="ev__muted">Загружаем…</p>
        } @else if (events().length === 0) {
          <p class="ev__muted">
            Пока пусто. Событие — это то, чего дело ждёт: звонок, приезд мастера, конец сезона.
          </p>
        } @else {
          <ul class="ev__list">
            @for (event of events(); track event.id) {
              <li class="ev__item" [class.ev__item--done]="event.happenedAt !== null">
                <span class="ev__title">{{ event.title }}</span>
                @if (event.expectedOn) {
                  <span class="ev__date">{{ formatDay(event.expectedOn) }}</span>
                }
                @if (event.happenedAt === null) {
                  <button type="button" class="ev__action" (click)="markHappened(event)">
                    Случилось
                  </button>
                } @else {
                  <span class="ev__done-mark">случилось</span>
                }
                <button
                  type="button"
                  class="ev__remove"
                  (click)="remove(event)"
                  [attr.aria-label]="'Удалить событие: ' + event.title"
                >
                  ×
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <div class="dlg__actions">
        <app-button variant="ghost" (click)="close()">Закрыть</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .ev__body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .ev__new {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .ev__input {
        flex: 1;
        min-width: 140px;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font-size: var(--fs-md);
      }

      .ev__input--date {
        flex: 0 0 auto;
      }

      .ev__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .ev__item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
      }

      .ev__item--done .ev__title {
        color: var(--color-text-muted);
      }

      .ev__title {
        flex: 1;
      }

      .ev__date,
      .ev__done-mark {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }

      .ev__action {
        min-height: 32px;
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: none;
        color: var(--color-text);
        cursor: pointer;
      }

      .ev__remove {
        min-width: 32px;
        border: none;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--fs-lg);
        cursor: pointer;
      }

      .ev__message {
        margin: 0;
        color: var(--color-success);
      }

      .ev__error {
        margin: 0;
        color: var(--color-danger);
      }

      .ev__muted {
        margin: 0;
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class TodoEventsModalComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _ref = inject(MatDialogRef<TodoEventsModalComponent>);

  /** Человеческий формат дня. */
  protected readonly formatDay = formatDay;
  /** События справочника. */
  protected readonly events = signal<TodoEventView[]>([]);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Сообщение об итоге действия. */
  protected readonly message = signal('');
  /** Текст ошибки. */
  protected readonly error = signal('');
  /** Черновик названия. */
  protected readonly draftTitleValue = signal('');
  /** Черновик даты. */
  protected readonly draftDateValue = signal('');
  /** Что-то менялось — список дел на экране надо перечитать. */
  private _changed = false;

  public constructor() {
    this.load();
  }

  /**
   * Черновик названия: чтение без аргумента, запись с аргументом.
   * @param value Новое значение.
   * @returns Текущее значение.
   */
  protected draftTitle(value?: string): string {
    if (value !== undefined) {
      this.draftTitleValue.set(value);
    }
    return this.draftTitleValue();
  }

  /**
   * Черновик даты.
   * @param value Новое значение.
   * @returns Текущее значение.
   */
  protected draftDate(value?: string): string {
    if (value !== undefined) {
      this.draftDateValue.set(value);
    }
    return this.draftDateValue();
  }

  /**
   * Загружает события, включая состоявшиеся — иначе непонятно, куда делось то, что ждали.
   * @returns Ничего.
   */
  protected load(): void {
    this.loading.set(true);
    this._api.listTodoEvents(true).subscribe({
      next: (rows) => {
        this.events.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err, 'Не удалось загрузить события.'));
        this.loading.set(false);
      },
    });
  }

  /**
   * Создаёт событие.
   * @param event Событие отправки формы.
   * @returns Ничего.
   */
  protected create(event: Event): void {
    event.preventDefault();
    const title = this.draftTitleValue().trim();
    if (title === '') {
      return;
    }
    const expectedOn = this.draftDateValue() === '' ? null : this.draftDateValue();
    this.error.set('');
    this._api.createTodoEvent({ title, expectedOn }).subscribe({
      next: (row) => {
        this.events.update((rows) => [...rows, row]);
        this.draftTitleValue.set('');
        this.draftDateValue.set('');
        this._changed = true;
      },
      error: (err: unknown) => this.error.set(errorMessage(err, 'Не удалось создать событие.')),
    });
  }

  /**
   * Отмечает событие состоявшимся и сообщает, сколько дел освободилось.
   * @param event Событие справочника.
   * @returns Ничего.
   */
  protected markHappened(event: TodoEventView): void {
    this.error.set('');
    this._api.markTodoEventHappened(event.id).subscribe({
      next: (result) => {
        this.events.update((rows) =>
          rows.map((row) => (row.id === result.event.id ? result.event : row)),
        );
        this.message.set(
          result.released > 0
            ? `Освободилось дел: ${String(result.released)}`
            : 'Отмечено. Дел, ждавших этого, не было.',
        );
        this._changed = true;
      },
      error: (err: unknown) => this.error.set(errorMessage(err, 'Не удалось отметить.')),
    });
  }

  /**
   * Удаляет событие; ожидание у дел снимает бэк.
   * @param event Событие справочника.
   * @returns Ничего.
   */
  protected remove(event: TodoEventView): void {
    this.error.set('');
    this._api.deleteTodoEvent(event.id).subscribe({
      next: () => {
        this.events.update((rows) => rows.filter((row) => row.id !== event.id));
        this.message.set('Событие удалено, ожидание у дел снято.');
        this._changed = true;
      },
      error: (err: unknown) => this.error.set(errorMessage(err, 'Не удалось удалить.')),
    });
  }

  /**
   * Закрывает модалку, сообщая вызывающему, надо ли перечитать список дел.
   * @returns Ничего.
   */
  protected close(): void {
    this._ref.close(this._changed);
  }
}
