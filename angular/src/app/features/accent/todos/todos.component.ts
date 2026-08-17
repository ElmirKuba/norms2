import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { MatDialog } from '@angular/material/dialog';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { TodoFormModalComponent } from './todo-form-modal.component';
import { TodoEventsModalComponent } from './todo-events-modal.component';
import { formatDay } from './format-day.util';
import type { TodoFormData } from './todo-form-modal.component';
import { AccentApiService } from '../services/accent-api.service';
import { TODO_KIND_LABELS } from '../accent.types';
import type { TodoEventView, TodoKind, TodoView } from '../accent.types';

/** Виды в порядке вкладок: дела первыми — это основной сценарий. */
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
  imports: [CardComponent, EmptyStateComponent, ButtonComponent, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="todos">
      <header class="todos__head">
        <h2>Дела</h2>
        <app-button variant="ghost" (click)="openEvents()">Чего ждём</app-button>
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
          [class.todos__mode-btn--active]="!archived()"
          (click)="setArchivedView(false)"
        >
          Живые
        </button>
        <button
          type="button"
          class="todos__mode-btn"
          [class.todos__mode-btn--active]="archived()"
          (click)="setArchivedView(true)"
        >
          Архив
        </button>
      </div>

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
        <ul class="todos__list" cdkDropList (cdkDropListDropped)="drop($event)">
          @for (item of items(); track item.id) {
            <li class="todos__item" [class.todos__item--done]="item.status === 'done'" cdkDrag>
              <button type="button" class="todos__grip" cdkDragHandle aria-label="Перетащить">
                ⠿
              </button>
              <input
                class="todos__check"
                type="checkbox"
                [checked]="item.status === 'done'"
                (change)="toggleDone(item)"
                [attr.aria-label]="'Отметить: ' + item.title"
              />
              <span class="todos__title">{{ item.title }}</span>
              <!-- Вид показываем только когда он не «дело»: список общий (вкладки убраны
                   17.08.2026), и подписывать каждую строку «Дело» — шум, а вот «Покупка» среди
                   дел различается с одного взгляда. -->
              @if (item.kind !== 'deed') {
                <span class="todos__kind" [attr.data-kind]="item.kind">{{ labels[item.kind] }}</span>
              }
              @if (item.badge) {
                <span class="todos__badge">{{ item.badge }}</span>
              }
              @if (item.waitsForEventId || item.waitsUntil) {
                <span class="todos__wait" [title]="waitTitle(item)">
                  ⏳ {{ waitLabel(item) }}
                </span>
              }
              @if (item.note || item.plannedOn) {
                <span class="todos__mark" [title]="item.note ?? ''">
                  @if (item.plannedOn) {
                    <span class="todos__date">{{ formatDay(item.plannedOn) }}</span>
                  }
                  @if (item.note) {
                    <span aria-label="Есть заметка">✎</span>
                  }
                </span>
              }
              <button
                type="button"
                class="todos__edit"
                (click)="toggleArchived(item)"
                [attr.aria-label]="(item.archived ? 'Вернуть из архива: ' : 'В архив: ') + item.title"
                [title]="item.archived ? 'Вернуть из архива' : 'В архив'"
              >
                {{ item.archived ? '↩' : '⇥' }}
              </button>
              <button
                type="button"
                class="todos__edit"
                (click)="openDetails(item)"
                [attr.aria-label]="'Детали: ' + item.title"
                title="Детали"
              >
                ⋯
              </button>
              <button
                type="button"
                class="todos__sub"
                (click)="startSub(item.id)"
                [attr.aria-label]="'Добавить подзадачу к: ' + item.title"
                title="Добавить подзадачу"
              >
                +
              </button>
              <button
                type="button"
                class="todos__remove"
                (click)="remove(item)"
                [attr.aria-label]="'Удалить: ' + item.title"
              >
                ×
              </button>

              @if (item.children.length > 0) {
                <ul class="todos__children" cdkDropList (cdkDropListDropped)="dropChild($event, item)">
                  @for (child of item.children; track child.id) {
                    <li
                      class="todos__item todos__item--child"
                      [class.todos__item--done]="child.status === 'done'"
                      cdkDrag
                    >
                      <button
                        type="button"
                        class="todos__grip"
                        cdkDragHandle
                        aria-label="Перетащить подзадачу"
                      >
                        ⠿
                      </button>
                      <input
                        class="todos__check"
                        type="checkbox"
                        [checked]="child.status === 'done'"
                        (change)="toggleDone(child, item.id)"
                        [attr.aria-label]="'Отметить: ' + child.title"
                      />
                      <span class="todos__title">{{ child.title }}</span>
                      <button
                        type="button"
                        class="todos__remove"
                        (click)="remove(child, item.id)"
                        [attr.aria-label]="'Удалить: ' + child.title"
                      >
                        ×
                      </button>
                    </li>
                  }
                </ul>
              }

              @if (subParentId() === item.id) {
                <form class="todos__subform" (submit)="addSub($event, item.id)">
                  <input
                    #subInput
                    class="todos__input"
                    type="text"
                    [value]="subDraft()"
                    (input)="subDraft($any($event.target).value)"
                    placeholder="Подзадача…"
                    aria-label="Название подзадачи"
                    maxlength="200"
                  />
                  <app-button type="submit" [disabled]="subDraft().trim() === ''">Добавить</app-button>
                  <app-button variant="ghost" type="button" (click)="cancelSub()">Отмена</app-button>
                </form>
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

      .todos__grip {
        min-width: 32px;
        min-height: var(--touch-min);
        border: none;
        background: none;
        color: var(--color-text-muted);
        cursor: grab;
        touch-action: none;
      }

      .todos__grip:active {
        cursor: grabbing;
      }

      .todos__check {
        width: 20px;
        height: 20px;
        accent-color: var(--color-accent);
        cursor: pointer;
      }

      .todos__item--child {
        border: none;
        background: none;
        padding: var(--space-1) 0;
        min-height: 36px;
      }

      /* Вложенность отмечается ОДНИМ отступом слева и линией, а не лесенкой из паддингов:
         подзадача выравнивается под заголовком родителя, и колонка чекбоксов остаётся ровной. */
      .todos__children {
        flex-basis: 100%;
        margin: var(--space-2) 0 0;
        padding: 0 0 0 var(--space-4);
        border-left: 1px solid var(--color-border);
        list-style: none;
      }

      .todos__subform {
        padding-left: var(--space-4);
      }

      .todos__subform {
        display: flex;
        flex-basis: 100%;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }

      .todos__item {
        flex-wrap: wrap;
      }

      .todos__wait {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-surface-2);
        color: var(--color-warning);
        font-size: var(--fs-xs);
        white-space: nowrap;
      }

      .todos__mark {
        display: inline-flex;
        gap: var(--space-2);
        align-items: center;
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }

      .todos__date {
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-surface-2);
      }

      .todos__edit {
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

      .todos__edit:hover {
        color: var(--color-accent);
      }

      .todos__sub {
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

      .todos__sub:hover {
        color: var(--color-accent);
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

      .todos__kind {
        padding: 2px var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        white-space: nowrap;
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
  private readonly _dialog = inject(MatDialog);

  /** Человеческий формат дня — общий с справочником событий. */
  protected readonly formatDay = formatDay;
  /** Подписи видов — для пометки на карточке. */
  protected readonly labels = TODO_KIND_LABELS;
  /** Записи списка. */
  protected readonly items = signal<TodoView[]>([]);
  /** События справочника — чтобы подписать ожидание на карточке названием, а не идентификатором. */
  protected readonly events = signal<TodoEventView[]>([]);
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
  /** Показывать архив вместо живых записей. */
  protected readonly archived = signal(false);
  /** Идентификатор записи, под которой открыта форма подзадачи, или null. */
  protected readonly subParentId = signal<string | null>(null);
  /** Черновик подзадачи. */
  protected readonly subDraftValue = signal('');

  public constructor() {
    this.load();
    this._loadEvents();
  }

  /**
   * Подтягивает справочник событий (включая состоявшиеся): подпись «ждёт X» должна остаться
   * читаемой и после того, как событие случилось, — до перезагрузки списка.
   * @returns Ничего.
   */
  private _loadEvents(): void {
    this._api.listTodoEvents(true).subscribe({
      next: (rows) => this.events.set(rows),
      error: () => this.events.set([]),
    });
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
    this._api.createTodo({ kind: 'deed', title }).subscribe({
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
   * Короткая подпись ожидания на карточке.
   *
   * Название события подтягивается из справочника; пока он не загружен — показываем нейтральное
   * «ждёт», а не пустоту: человек должен видеть, что дело **заблокировано не им**, даже если
   * подробность ещё едет.
   * @param item Запись.
   * @returns Текст подписи.
   */
  protected waitLabel(item: TodoView): string {
    const event = this.events().find((row) => row.id === item.waitsForEventId);
    if (event) {
      return event.expectedOn === null ? event.title : `${event.title}, ${formatDay(event.expectedOn)}`;
    }
    if (item.waitsUntil !== null) {
      return `не раньше ${formatDay(item.waitsUntil)}`;
    }
    return 'ждёт';
  }

  /**
   * Подсказка при наведении: полная формулировка ожидания.
   * @param item Запись.
   * @returns Текст подсказки.
   */
  protected waitTitle(item: TodoView): string {
    const parts = [this.waitLabel(item)];
    if (item.waitsUntil !== null && item.waitsForEventId !== null) {
      parts.push(`не раньше ${formatDay(item.waitsUntil)}`);
    }
    return `Ждёт: ${parts.join(' · ')}`;
  }

  /**
   * Открывает справочник событий.
   *
   * После закрытия перечитываем список: событие могло состояться, и тогда часть дел перестала
   * ждать — экран обязан это показать, иначе человек будет видеть ожидание, которого уже нет.
   * @returns Ничего.
   */
  protected openEvents(): void {
    void this._dialog
      .open(TodoEventsModalComponent, { width: MODAL_SMALL_WIDTH, autoFocus: false })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) {
          this.load();
          this._loadEvents();
        }
      });
  }

  /**
   * Открывает детали записи: заметка, метка, назначенный день.
   *
   * Форма сама зовёт API и закрывается только при успехе — при ошибке остаётся открытой, и
   * набранный текст не теряется.
   * @param item Запись.
   * @returns Ничего.
   */
  protected openDetails(item: TodoView): void {
    const data: TodoFormData = {
      todo: item,
      submit: (payload) => this._api.updateTodo(item.id, payload),
    };
    void this._dialog
      .open(TodoFormModalComponent, { data, width: MODAL_SMALL_WIDTH, autoFocus: false })
      .afterClosed()
      .subscribe((saved) => {
        if (saved === true) {
          this.load();
        }
      });
  }

  /**
   * Открывает форму подзадачи под записью.
   * @param parentId Идентификатор родителя.
   * @returns Ничего.
   */
  protected startSub(parentId: string): void {
    this.subParentId.set(this.subParentId() === parentId ? null : parentId);
    this.subDraftValue.set('');
  }

  /**
   * Закрывает форму подзадачи.
   * @returns Ничего.
   */
  protected cancelSub(): void {
    this.subParentId.set(null);
    this.subDraftValue.set('');
  }

  /**
   * Черновик подзадачи: чтение без аргумента, запись с аргументом.
   * @param value Новое значение.
   * @returns Текущее значение.
   */
  protected subDraft(value?: string): string {
    if (value !== undefined) {
      this.subDraftValue.set(value);
    }
    return this.subDraftValue();
  }

  /**
   * Добавляет подзадачу. Форма остаётся открытой — подзадачи чаще всего заводят пачкой
   * («оплатить пошлину», «сдать документы», «забрать»).
   * @param event Событие отправки формы.
   * @param parentId Идентификатор родителя.
   * @returns Ничего.
   */
  protected addSub(event: Event, parentId: string): void {
    event.preventDefault();
    const title = this.subDraftValue().trim();
    if (title === '') {
      return;
    }
    this._api.createTodo({ kind: 'deed', title, parentId }).subscribe({
      next: (row) => {
        this.items.update((rows) =>
          rows.map((current) =>
            current.id === parentId
              ? { ...current, children: [...current.children, row] }
              : current,
          ),
        );
        this.subDraftValue.set('');
      },
      error: (err: unknown) => {
        this._modal.error('Не удалось добавить подзадачу', errorMessage(err));
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
  protected toggleDone(item: TodoView, parentId?: string): void {
    const done = item.status !== 'done';
    this._api.setTodoDone(item.id, done).subscribe({
      next: (row) => {
        this.items.update((rows) =>
          parentId === undefined
            ? this._sorted(rows.map((current) => (current.id === row.id ? row : current)))
            : rows.map((current) =>
                current.id === parentId
                  ? {
                      ...current,
                      children: this._sorted(
                        current.children.map((child) => (child.id === row.id ? row : child)),
                      ),
                    }
                  : current,
              ),
        );
      },
      error: (err: unknown) => {
        this._modal.error('Не удалось отметить', errorMessage(err));
      },
    });
  }

  /**
   * Сохраняет новый порядок после перетаскивания.
   *
   * Оптимистично: список переставляется сразу, запрос уходит следом. Ошибка — перезагружаем с
   * сервера и говорим об этом: молча оставить порядок, которого нет в базе, хуже, чем откатить.
   * @param event Событие перетаскивания.
   * @returns Ничего.
   */
  protected drop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.items()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.set(next);
    this._api.reorderTodos(next.map((row) => row.id)).subscribe({
      error: (err: unknown) => {
        this.load();
        this._modal.error('Не удалось сохранить порядок', errorMessage(err));
      },
    });
  }

  /**
   * Сохраняет порядок подзадач внутри одной записи.
   * @param event Событие перетаскивания.
   * @param parent Родительская запись.
   * @returns Ничего.
   */
  protected dropChild(event: CdkDragDrop<unknown>, parent: TodoView): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...parent.children];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.update((rows) =>
      rows.map((row) => (row.id === parent.id ? { ...row, children: next } : row)),
    );
    this._api.reorderTodos(next.map((row) => row.id)).subscribe({
      error: (err: unknown) => {
        this.load();
        this._modal.error('Не удалось сохранить порядок', errorMessage(err));
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
  protected remove(item: TodoView, parentId?: string): void {
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
            this.items.update((rows) =>
              parentId === undefined
                ? rows.filter((current) => current.id !== item.id)
                : rows.map((current) =>
                    current.id === parentId
                      ? {
                          ...current,
                          children: current.children.filter((child) => child.id !== item.id),
                        }
                      : current,
                  ),
            );
          },
          error: (err: unknown) => {
            this._modal.error('Не удалось удалить', errorMessage(err));
          },
        });
      });
  }

  /**
   * Загружает записи текущего вида.
   * @returns Ничего; результат складывается в сигналы.
   */
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this._api.listTodos(this.archived()).subscribe({
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
   * Переключает показ архива.
   * @param value `true` — показать архив.
   * @returns Ничего.
   */
  protected setArchivedView(value: boolean): void {
    if (value === this.archived()) {
      return;
    }
    this.archived.set(value);
    this.items.set([]);
    this.cancelSub();
    this.load();
  }

  /**
   * Прячет запись в архив или возвращает её.
   *
   * Архив — не удаление: у спрятанного обязан быть экран, где его видно, и способ вернуть.
   * Здесь это переключатель «Живые ↔ Архив» рядом со списком, а не спрятанный пункт меню.
   * @param item Запись.
   * @returns Ничего.
   */
  protected toggleArchived(item: TodoView): void {
    const request = item.archived ? this._api.restoreTodo(item.id) : this._api.archiveTodo(item.id);
    request.subscribe({
      next: () => {
        // Запись уходит из текущего списка: она переехала в другой режим показа.
        this.items.update((rows) => rows.filter((current) => current.id !== item.id));
      },
      error: (err: unknown) => {
        this._modal.error('Не удалось перенести', errorMessage(err));
      },
    });
  }

  /**
   * Заголовок пустого состояния: пустота должна звучать приглашением, а не отчётом об отсутствии
   * данных.
   * @returns Текст заголовка.
   */
  protected emptyTitle(): string {
    return this.archived() ? 'В архиве пусто' : 'Пока пусто';
  }

  /**
   * Пояснение под заголовком пустого состояния.
   * @returns Текст пояснения.
   */
  protected emptyDescription(): string {
    if (this.archived()) {
      return 'Сюда попадает то, что убрано с глаз, но не удалено. Вернуть можно тем же значком.';
    }
    return (
      'Запиши одной строкой — дело, мысль или покупку. Решать, чем это является и когда делать, ' +
      'можно потом.'
    );
  }
}
