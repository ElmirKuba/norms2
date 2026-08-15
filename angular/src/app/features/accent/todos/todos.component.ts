import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { errorMessage } from '../../../core/http/error-message.util';
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
              <span class="todos__title">{{ item.title }}</span>
              @if (item.badge) {
                <span class="todos__badge">{{ item.badge }}</span>
              }
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

  public constructor() {
    this.load();
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
