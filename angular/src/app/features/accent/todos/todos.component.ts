import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { ModalService } from '../../../shared/modals/modal.service';
import { AccentApiService } from '../services/accent-api.service';
import { TODO_KIND_LABELS } from '../accent.types';
import type { TodoKind, TodoView } from '../accent.types';

/** Виды в порядке вкладок: дела первыми — это основной сценарий. */
const KIND_ORDER: TodoKind[] = ['deed', 'idea', 'purchase'];

/**
 * Экран списков дел (`/accent/todos`, подфаза 2.10 блок C).
 *
 * **Зачем он появился.** Продукт требовал классифицировать мысль в момент записи: чтобы записать
 * «сходить в МФЦ», надо было решить, в какой это день и какого вида задача. Результат измерим —
 * за два с половиной месяца разовых задач заведено ноль, а живой список дел владельца всё это
 * время жил в стороннем заметочнике.
 *
 * Здесь обязателен **только заголовок**: одна строка, Enter — и запись в списке.
 *
 * Выполненное **не исчезает**, а уходит вниз: «что я уже сделал» — тоже информация (приём взят из
 * живого списка, где закрытые пункты сохранены осознанно).
 */
@Component({
  selector: 'app-todos',
  imports: [CardComponent, EmptyStateComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="todos">
      <header class="todos__head">
        <h2>Дела</h2>
      </header>

      <form class="todos__new" (submit)="add($event)">
        <input
          #draftInput
          class="todos__input"
          type="text"
          [value]="draft()"
          (input)="draft($any($event.target).value)"
          [placeholder]="inputPlaceholder()"
          aria-label="Что записать"
          maxlength="200"
        />
        <app-button type="submit" [loading]="adding()" [disabled]="draft().trim() === ''">
          Добавить
        </app-button>
      </form>
      @if (addError()) {
        <p class="todos__error" role="alert">{{ addError() }}</p>
      }

      <nav class="todos__tabs" role="tablist" aria-label="Виды записей">
        @for (kind of kinds; track kind) {
          <button
            type="button"
            role="tab"
            class="todos__tab"
            [class.todos__tab--active]="kind === activeKind()"
            [attr.aria-selected]="kind === activeKind()"
            (click)="switchKind(kind)"
          >
            {{ labels[kind] }}
          </button>
        }
      </nav>

      @if (loading()) {
        <div class="todos__skeleton" aria-hidden="true">
          @for (row of [1, 2, 3]; track row) {
            <div class="todos__skeleton-row"></div>
          }
        </div>
      } @else if (error()) {
        <app-card>
          <p class="todos__error">{{ error() }}</p>
          <app-button variant="ghost" (click)="load()">Повторить</app-button>
        </app-card>
      } @else if (items().length === 0) {
        <app-empty-state [title]="emptyTitle()" [text]="emptyDescription()"></app-empty-state>
      } @else {
        <ul class="todos__list">
          @for (item of items(); track item.id) {
            <li class="todos__item" [class.todos__item--done]="item.status === 'done'">
              <input
                class="todos__check"
                type="checkbox"
                [checked]="item.status === 'done'"
                (change)="toggleDone(item)"
                [attr.aria-label]="'Отметить: ' + item.title"
              />
              <span class="todos__title">{{ item.title }}</span>
              @if (item.badge) {
                <span class="todos__badge">{{ item.badge }}</span>
              }
              <button
                type="button"
                class="todos__remove"
                (click)="remove(item)"
                [attr.aria-label]="'Удалить: ' + item.title"
              >
                ×
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .todos {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .todos__head h2 {
        margin: 0;
        font-size: var(--fs-xl);
      }

      .todos__tabs {
        display: flex;
        gap: var(--space-2);
        border-bottom: 1px solid var(--color-border);
      }

      .todos__tab {
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: none;
        border-bottom: 2px solid transparent;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--fs-md);
        cursor: pointer;
        transition: color var(--transition), border-color var(--transition);
      }

      .todos__tab:hover {
        color: var(--color-text);
      }

      .todos__tab--active {
        color: var(--color-accent);
        border-bottom-color: var(--color-accent);
      }

      .todos__new {
        display: flex;
        gap: var(--space-2);
      }

      .todos__input {
        flex: 1;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font-size: var(--fs-md);
      }

      .todos__input:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: 1px;
      }

      .todos__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .todos__item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-height: var(--touch-min);
        padding: var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }

      /* Выполненное не исчезает, а гаснет: «что я уже сделал» — тоже информация. */
      .todos__item--done .todos__title {
        color: var(--color-text-muted);
        text-decoration: line-through;
      }

      .todos__title {
        flex: 1;
      }

      .todos__check {
        width: 20px;
        height: 20px;
        accent-color: var(--color-accent);
        cursor: pointer;
      }

      .todos__remove {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: none;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--fs-lg);
        line-height: 1;
        cursor: pointer;
        transition: color var(--transition);
      }

      .todos__remove:hover {
        color: var(--color-danger);
      }

      .todos__badge {
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-surface-2);
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }

      .todos__skeleton {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .todos__skeleton-row {
        height: var(--touch-min);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
      }

      .todos__error {
        margin: 0 0 var(--space-3);
        color: var(--color-danger);
      }
    `,
  ],
})
export class TodosComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _modal = inject(ModalService);

  /** Виды в порядке вкладок. */
  protected readonly kinds = KIND_ORDER;
  /** Подписи видов. */
  protected readonly labels = TODO_KIND_LABELS;
  /** Текущий вид. */
  protected readonly activeKind = signal<TodoKind>('deed');
  /** Записи текущего вида. */
  protected readonly items = signal<TodoView[]>([]);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Текст ошибки или пустая строка. */
  protected readonly error = signal('');
  /** Черновик новой записи. */
  protected readonly draftValue = signal('');
  /** Идёт добавление. */
  protected readonly adding = signal(false);
  /** Ошибка добавления. */
  protected readonly addError = signal('');
  /** Поле ввода — чтобы вернуть в него фокус после добавления. */
  private readonly _draftInput = viewChild<ElementRef<HTMLInputElement>>('draftInput');

  public constructor() {
    this.load();
  }

  /**
   * Черновик: чтение без аргумента, запись с аргументом — чтобы шаблон обходился одним именем.
   * @param value Новое значение (или ничего — тогда просто читаем).
   * @returns Текущее значение черновика.
   */
  protected draft(value?: string): string {
    if (value !== undefined) {
      this.draftValue.set(value);
    }
    return this.draftValue();
  }

  /**
   * Добавляет запись и **возвращает фокус в поле** — чтобы список переносился очередью, не
   * отрывая рук от клавиатуры. Это и есть смысл шага: порог записи должен быть нулевым.
   * @param event Событие отправки формы.
   * @returns Ничего.
   */
  protected add(event: Event): void {
    event.preventDefault();
    const title = this.draftValue().trim();
    if (title === '' || this.adding()) {
      return;
    }
    this.adding.set(true);
    this.addError.set('');
    this._api.createTodo({ kind: this.activeKind(), title }).subscribe({
      next: (row) => {
        // Дописываем в конец: порядок ввода = порядок в списке, ничего не «прыгает».
        this.items.update((rows) => [...rows, row]);
        this.draftValue.set('');
        this.adding.set(false);
        this._draftInput()?.nativeElement.focus();
        // Поле НЕ блокируется на время запроса намеренно: человек переносит список очередью,
        // и ждать ответа сервера, чтобы напечатать следующую строку, — прямой урон смыслу шага.
        // Заодно это чинит фокус: на заблокированный элемент он не встаёт (поймано проверкой).
      },
      error: (err: unknown) => {
        this.addError.set(errorMessage(err, 'Не удалось добавить запись.'));
        this.adding.set(false);
      },
    });
  }

  /**
   * Переключает отметку выполнения.
   *
   * Обновляем строку на месте, а не перезагружаем список: перезагрузка сбросила бы позицию
   * прокрутки и «моргнула» бы всем экраном ради одной галочки.
   * @param item Запись.
   * @returns Ничего.
   */
  protected toggleDone(item: TodoView): void {
    const done = item.status !== 'done';
    this._api.setTodoDone(item.id, done).subscribe({
      next: (row) => {
        this.items.update((rows) =>
          this._sorted(rows.map((current) => (current.id === row.id ? row : current))),
        );
      },
      error: (err: unknown) => {
        this._modal.error('Не удалось отметить', errorMessage(err));
      },
    });
  }

  /**
   * Раскладывает записи так же, как сервер: открытые сверху, выполненные снизу, внутри — по
   * позиции.
   *
   * Нужно, потому что после отметки строка обновляется **на месте**, а обещание продукта —
   * «выполненное уходит вниз, но не исчезает». Без локальной пересортировки оно выполнялось бы
   * только после перезагрузки страницы, то есть выглядело бы как случайность.
   * @param rows Записи.
   * @returns Отсортированная копия.
   */
  private _sorted(rows: TodoView[]): TodoView[] {
    return [...rows].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'done' ? 1 : -1;
      }
      return left.position - right.position;
    });
  }

  /**
   * Удаляет запись после подтверждения.
   *
   * Подтверждение обязательно: у записи могут быть подзадачи, и они уходят вместе с ней —
   * человек должен об этом узнать до, а не после.
   * @param item Запись.
   * @returns Ничего.
   */
  protected remove(item: TodoView): void {
    const hasChildren = item.children.length > 0;
    void this._modal
      .confirm({
        title: 'Удалить запись?',
        text: hasChildren
          ? `«${item.title}» и её подзадачи (${String(item.children.length)}) будут удалены.`
          : `«${item.title}» будет удалена.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .then((ok) => {
        if (!ok) {
          return;
        }
        this._api.deleteTodo(item.id).subscribe({
          next: () => {
            this.items.update((rows) => rows.filter((current) => current.id !== item.id));
          },
          error: (err: unknown) => {
            this._modal.error('Не удалось удалить', errorMessage(err));
          },
        });
      });
  }

  /**
   * Подсказка в поле ввода — своя для каждого вида.
   * @returns Текст подсказки.
   */
  protected inputPlaceholder(): string {
    switch (this.activeKind()) {
      case 'idea':
        return 'Записать идею…';
      case 'purchase':
        return 'Что купить…';
      default:
        return 'Что нужно сделать…';
    }
  }

  /**
   * Загружает записи текущего вида.
   * @returns Ничего; результат складывается в сигналы.
   */
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this._api.listTodos(this.activeKind()).subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err, 'Не удалось загрузить список.'));
        this.loading.set(false);
      },
    });
  }

  /**
   * Переключает вид.
   * @param kind Вид записи.
   * @returns Ничего.
   */
  protected switchKind(kind: TodoKind): void {
    if (kind === this.activeKind()) {
      return;
    }
    this.activeKind.set(kind);
    this.items.set([]);
    this.load();
  }

  /**
   * Заголовок пустого состояния — свой для каждого вида: пустота должна звучать приглашением,
   * а не отчётом об отсутствии данных.
   * @returns Текст заголовка.
   */
  protected emptyTitle(): string {
    switch (this.activeKind()) {
      case 'idea':
        return 'Идей пока нет';
      case 'purchase':
        return 'Список покупок пуст';
      default:
        return 'Дел пока нет';
    }
  }

  /**
   * Пояснение под заголовком пустого состояния.
   * @returns Текст пояснения.
   */
  protected emptyDescription(): string {
    switch (this.activeKind()) {
      case 'idea':
        return 'Сюда можно записать мысль, про которую ещё не решено, делать её или нет.';
      case 'purchase':
        return 'Сюда — то, что нужно купить. Без даты и без лишних полей.';
      default:
        return 'Запиши дело одной строкой — решать, когда и как, можно потом.';
    }
  }
}
