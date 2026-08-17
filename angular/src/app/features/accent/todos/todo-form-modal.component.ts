import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import type { Observable } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { AccentApiService } from '../services/accent-api.service';
import { formatDay } from './format-day.util';
import { errorMessage } from '../../../core/http/error-message.util';
import { TODO_KIND_LABELS } from '../accent.types';
import type { TodoEventView, TodoKind, TodoPayload, TodoView } from '../accent.types';

/** Данные в модалку. */
export interface TodoFormData {
  /** Редактируемая запись. */
  todo: TodoView;
  /**
   * Сохранение: форма сама зовёт API и закрывается только при успехе. При ошибке остаётся
   * открытой с текстом — ввод не теряется.
   */
  submit: (payload: Partial<TodoPayload>) => Observable<unknown>;
}

/**
 * Модалка деталей записи (2.10·C7): заметка, метка и назначенный день.
 *
 * **Почему это отдельный экран, а не поля в строке ввода.** Порог записи должен оставаться
 * нулевым: заголовок и Enter. Всё остальное человек дописывает потом и по желанию — тогда, когда
 * уже решил, что с этим делом делать.
 */
@Component({
  selector: 'app-todo-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>Детали записи</h2>
      </div>

      <form class="dlg__form" [formGroup]="form" (ngSubmit)="save()">
        <div class="dlg__body tf__body">
          <label class="tf__field">
            <span class="tf__label">Название</span>
            <input class="tf__input" type="text" formControlName="title" maxlength="200" />
          </label>

          <label class="tf__field">
            <span class="tf__label">Что это</span>
            <select class="tf__input" formControlName="kind">
              @for (kind of kinds; track kind) {
                <option [value]="kind">{{ labels[kind] }}</option>
              }
            </select>
            <span class="tf__hint">
              Пометка, а не перегородка: список общий, вид нужен, чтобы отличить «надо купить» от
              «надо сделать», когда до записи дойдут руки.
            </span>
          </label>

          <label class="tf__field">
            <span class="tf__label">Заметка</span>
            <textarea
              class="tf__input tf__input--area"
              formControlName="note"
              rows="4"
              maxlength="4000"
              placeholder="Условия, адреса, что уточнить — всё, что не помещается в заголовок"
            ></textarea>
          </label>

          <label class="tf__field">
            <span class="tf__label">Метка</span>
            <input
              class="tf__input"
              type="text"
              formControlName="badge"
              maxlength="64"
              placeholder="Например: в аптеке, по пути домой"
            />
          </label>

          <label class="tf__field">
            <span class="tf__label">Чего ждёт</span>
            <select class="tf__input" formControlName="waitsForEventId">
              <option value="">Ничего не ждёт</option>
              @for (event of events(); track event.id) {
                <option [value]="event.id">
                  {{ event.title }}@if (event.expectedOn) { — {{ formatDay(event.expectedOn) }} }
                </option>
              }
            </select>
            <span class="tf__hint">
              Дело, которое ждёт мастера или звонка, — не невыполненное: раньше срока его и нельзя
              сделать.
            </span>
          </label>

          <label class="tf__field">
            <span class="tf__label">Не раньше даты</span>
            <input class="tf__input" type="date" formControlName="waitsUntil" />
          </label>

          <label class="tf__field">
            <span class="tf__label">Когда сделать</span>
            <input class="tf__input" type="date" formControlName="plannedOn" />
            <span class="tf__hint">Необязательно. День можно назначить позже.</span>
          </label>

          @if (error()) {
            <p class="tf__error" role="alert">{{ error() }}</p>
          }
        </div>

        <div class="dlg__actions">
          <app-button variant="ghost" type="button" (click)="close()">Отмена</app-button>
          <app-button type="submit" [loading]="saving()" [disabled]="form.invalid">
            Сохранить
          </app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .tf__body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .tf__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .tf__label {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }

      .tf__input {
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font-size: var(--fs-md);
        font-family: inherit;
      }

      .tf__input--area {
        min-height: 96px;
        resize: vertical;
      }

      .tf__hint {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }

      .tf__error {
        margin: 0;
        color: var(--color-danger);
      }
    `,
  ],
})
export class TodoFormModalComponent {
  private readonly _data = inject<TodoFormData>(MAT_DIALOG_DATA);
  private readonly _ref = inject(MatDialogRef<TodoFormModalComponent>);
  private readonly _api = inject(AccentApiService);

  /** Идёт сохранение. */
  protected readonly saving = signal(false);
  /** Текст ошибки сохранения. */
  protected readonly error = signal('');

  /** Форма деталей. */
  /** Виды записи для выпадающего списка. */
  protected readonly kinds: TodoKind[] = ['deed', 'idea', 'purchase'];
  /** Подписи видов. */
  protected readonly labels = TODO_KIND_LABELS;

  protected readonly form = new FormGroup({
    kind: new FormControl<TodoKind>(this._data.todo.kind, { nonNullable: true }),
    title: new FormControl(this._data.todo.title, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    note: new FormControl(this._data.todo.note ?? '', { nonNullable: true }),
    badge: new FormControl(this._data.todo.badge ?? '', { nonNullable: true }),
    plannedOn: new FormControl(this._data.todo.plannedOn ?? '', { nonNullable: true }),
    waitsForEventId: new FormControl(this._data.todo.waitsForEventId ?? '', { nonNullable: true }),
    waitsUntil: new FormControl(this._data.todo.waitsUntil ?? '', { nonNullable: true }),
  });

  /** События справочника — чтобы выбрать, чего ждёт дело. */
  protected readonly events = signal<TodoEventView[]>([]);
  /** Человеческий формат дня. */
  protected readonly formatDay = formatDay;

  public constructor() {
    // Только ещё не случившиеся: предлагать ждать того, что уже произошло, бессмысленно.
    this._api.listTodoEvents(false).subscribe({
      next: (rows) => this.events.set(rows),
      error: () => this.events.set([]),
    });
  }

  /**
   * Сохраняет изменения; пустые строки отправляются как `null` — «нет значения», а не «пустая
   * строка», иначе в базе копились бы пустышки, неотличимые от заполненного.
   * @returns Ничего.
   */
  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this._data
      .submit({
        kind: raw.kind,
        title: raw.title.trim(),
        note: raw.note.trim() === '' ? null : raw.note.trim(),
        badge: raw.badge.trim() === '' ? null : raw.badge.trim(),
        plannedOn: raw.plannedOn === '' ? null : raw.plannedOn,
        waitsForEventId: raw.waitsForEventId === '' ? null : raw.waitsForEventId,
        waitsUntil: raw.waitsUntil === '' ? null : raw.waitsUntil,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this._ref.close(true),
        error: (err: unknown) => this.error.set(errorMessage(err, 'Не удалось сохранить.')),
      });
  }

  /**
   * Закрывает модалку без сохранения.
   * @returns Ничего.
   */
  protected close(): void {
    this._ref.close(null);
  }
}
