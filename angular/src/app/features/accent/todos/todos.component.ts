import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CdkDrag, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { TodoNodeComponent } from './todo-node.component';
import { TodosStore } from './todos-store.service';
import type { TodoGroupKey } from './todo-groups.util';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

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
  imports: [TodoNodeComponent, CardComponent, EmptyStateComponent, ButtonComponent, CdkDropList, CdkDrag],
  providers: [TodosStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="todos">
      <header class="todos__head">
        <h2>Дела</h2>
        <app-button variant="ghost" (click)="store.openEvents()">Чего ждём</app-button>
      </header>

      <form class="todos__new" (submit)="add($event)">
        <input
          #draftInput
          class="todos__input"
          type="text"
          [value]="draft()"
          (input)="draft($any($event.target).value)"
          placeholder="Что нужно сделать, купить или просто не забыть…"
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

      <div class="todos__mode">
        <button
          type="button"
          class="todos__mode-btn"
          [class.todos__mode-btn--active]="!store.archived()"
          (click)="setArchivedView(false)"
        >
          Живые
        </button>
        <button
          type="button"
          class="todos__mode-btn"
          [class.todos__mode-btn--active]="store.archived()"
          (click)="setArchivedView(true)"
        >
          Архив
        </button>
      </div>

      <!-- Поиск появляется, только когда есть что искать: на пустом экране строка фильтра —
           лишний элемент управления, который нечего фильтровать (·E2). -->
      @if (store.items().length > 0) {
        <div class="todos__search">
          <input
            class="todos__input"
            type="search"
            [value]="store.query()"
            (input)="store.query.set($any($event.target).value)"
            placeholder="Найти среди записей…"
            aria-label="Найти среди записей"
            maxlength="200"
          />
          @if (store.searching()) {
            <button
              type="button"
              class="todos__search-clear"
              (click)="store.query.set('')"
              aria-label="Сбросить поиск"
              title="Сбросить поиск"
            >
              ×
            </button>
          }
        </div>
      }

      @if (store.loading()) {
        <div class="todos__skeleton" aria-hidden="true">
          @for (row of [1, 2, 3]; track row) {
            <div class="todos__skeleton-row"></div>
          }
        </div>
      } @else if (store.error()) {
        <app-card>
          <p class="todos__error">{{ store.error() }}</p>
          <app-button variant="ghost" (click)="store.load()">Повторить</app-button>
        </app-card>
      } @else if (store.items().length === 0) {
        <app-empty-state [title]="emptyTitle()" [text]="emptyDescription()"></app-empty-state>
      } @else if (store.visible().length === 0) {
        <!-- Пустой результат поиска — СВОЁ состояние, а не «пока пусто»: список не пуст, просто
             под запрос ничего не подошло, и человеку нужен выход обратно, а не приглашение
             записать первое дело (·E2). -->
        <app-empty-state
          title="Ничего не нашлось"
          [text]="'По запросу «' + store.query().trim() + '» нет ни записей, ни подзадач. Попробуй короче или сбрось поиск.'"
        >
          <app-button variant="ghost" (click)="store.query.set('')">Сбросить поиск</app-button>
        </app-empty-state>
      } @else if (store.archived()) {
        <!-- Архив плоским списком: там лежит убранное с глаз, и раскладка по срокам ему не нужна. -->
        <ul class="todos__list" cdkDropList (cdkDropListDropped)="dropArchived($event)">
          @for (item of store.visible(); track item.id) {
            <li app-todo-node [item]="item" [depth]="1" cdkDrag [cdkDragDisabled]="store.searching()"></li>
          }
        </ul>
      } @else {
        @for (group of store.groups(); track group.key) {
          <section class="todos__group">
            <h3 class="todos__group-title">{{ group.title }}</h3>
            <ul
              class="todos__list"
              cdkDropList
              (cdkDropListDropped)="dropInGroup($event, group.key)"
            >
              @for (item of group.items; track item.id) {
                <!-- Под фильтром перетаскивание выключено: видимый порядок — не весь порядок,
                     и сохранять его значило бы перемешать список после сброса поиска. -->
                <li app-todo-node [item]="item" [depth]="1" cdkDrag [cdkDragDisabled]="store.searching()"></li>
              }
            </ul>
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      .todos {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        /* Тот же отступ, что у остальных экранов раздела: без него список прилипает к краю. */
        padding: var(--space-4) 0;
      }

      .todos__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .todos__head h2 {
        margin: 0;
        font-size: var(--fs-xl);
      }

      .todos__mode {
        display: flex;
        gap: var(--space-2);
      }

      .todos__mode-btn {
        min-height: 32px;
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
        cursor: pointer;
      }

      .todos__mode-btn--active {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .todos__new {
        display: flex;
        gap: var(--space-2);
      }

      .todos__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .todos__group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .todos__search {
        position: relative;
        display: flex;
      }

      /* Крестик лежит ПОВЕРХ поля справа, а не рядом: своя кнопка в строке увела бы поле
         влево и сломала бы выравнивание с формой добавления сверху. */
      .todos__search-clear {
        position: absolute;
        top: 0;
        right: 0;
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: none;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--fs-lg);
        line-height: 1;
        cursor: pointer;
      }

      .todos__search-clear:hover {
        color: var(--color-accent);
      }

      /* Заголовок группы — тихая метка, а не заголовок раздела: он отвечает на вопрос «когда»,
         и «Просрочено» не должно выглядеть строже, чем «Сегодня» (ADR-0049 — продукт напоминает,
         а не выставляет счёт). Поэтому один и тот же приглушённый стиль на все группы. */
      .todos__group-title {
        margin: 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
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
    `,
  ],
})
export class TodosComponent {
  /** Состояние и операции экрана — общие со всеми узлами дерева. */
  protected readonly store = inject(TodosStore);

  /** Черновик новой записи. */
  protected readonly draftValue = signal('');
  /** Идёт добавление. */
  protected readonly adding = signal(false);
  /** Ошибка добавления. */
  protected readonly addError = signal('');
  /** Поле ввода — чтобы вернуть в него фокус после добавления. */
  private readonly _draftInput = viewChild<ElementRef<HTMLInputElement>>('draftInput');

  public constructor() {
    this.store.load();
    this.store.loadEvents();
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
   *
   * Поле НЕ блокируется на время запроса намеренно: человек переносит список очередью, и ждать
   * ответа сервера, чтобы напечатать следующую строку, — прямой урон смыслу шага. Заодно это
   * чинит фокус: на заблокированный элемент он не встаёт (поймано проверкой).
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
    this.store.add(
      title,
      () => {
        this.draftValue.set('');
        this.adding.set(false);
        this._draftInput()?.nativeElement.focus();
      },
      (message) => {
        this.addError.set(message);
        this.adding.set(false);
      },
    );
  }

  /**
   * Сохраняет новый порядок внутри группы.
   * @param event Событие перетаскивания.
   * @param key Ключ группы, внутри которой тащили.
   * @returns Ничего.
   */
  protected dropInGroup(event: CdkDragDrop<unknown>, key: TodoGroupKey): void {
    this.store.reorderInGroup(event, key);
  }

  /**
   * Сохраняет новый порядок в архиве — там список плоский и группы не рисуются.
   * @param event Событие перетаскивания.
   * @returns Ничего.
   */
  protected dropArchived(event: CdkDragDrop<unknown>): void {
    this.store.reorderArchived(event);
  }

  /**
   * Переключает показ архива.
   * @param value `true` — показать архив.
   * @returns Ничего.
   */
  protected setArchivedView(value: boolean): void {
    if (value === this.store.archived()) {
      return;
    }
    this.store.archived.set(value);
    this.store.items.set([]);
    this.store.cancelSub();
    this.store.load();
  }

  /**
   * Заголовок пустого состояния: пустота должна звучать приглашением, а не отчётом об отсутствии
   * данных.
   * @returns Текст заголовка.
   */
  protected emptyTitle(): string {
    return this.store.archived() ? 'В архиве пусто' : 'Пока пусто';
  }

  /**
   * Пояснение под заголовком пустого состояния.
   * @returns Текст пояснения.
   */
  protected emptyDescription(): string {
    if (this.store.archived()) {
      return 'Сюда попадает то, что убрано с глаз, но не удалено. Вернуть можно тем же значком.';
    }
    return (
      'Запиши одной строкой — дело, мысль или покупку. Решать, чем это является и когда делать, ' +
      'можно потом.'
    );
  }
}
