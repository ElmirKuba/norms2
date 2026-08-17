import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { TodosStore, TODO_MAX_DEPTH } from './todos-store.service';
import { formatDay } from './format-day.util';
import { TODO_KIND_LABELS } from '../accent.types';
import type { TodoView } from '../accent.types';

/**
 * Одна запись списка дел вместе со своими подзадачами (2.10·C5).
 *
 * **Компонент с хостом `li`, а не шаблон** — и это не стилистика. CDK связывает перетаскиваемый
 * элемент со списком **через DI** (`inject(CDK_DROP_LIST, { skipSelf: true })`), а инжектор
 * embedded-view берётся от места **объявления** шаблона, а не вставки. Рекурсия через
 * `ngTemplateOutlet` из-за этого давала элементы с `dropContainer === null`: ручка «⠿» бралась, а
 * список не двигался (поймано Elmir 17.08.2026). Когда `li` объявлен прямо внутри своего
 * `<ul cdkDropList>` — на каждом уровне своя пара «список ↔ элементы», и DI находит нужную.
 *
 * Компонент рекурсивен: внутри себя он снова рисует `app-todo-node` для детей. Глубина
 * ограничена доменом (`TODO_MAX_DEPTH`).
 */
@Component({
  selector: 'li[app-todo-node]',
  imports: [ButtonComponent, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'todos__item',
    '[class.todos__item--child]': 'depth() > 1',
    '[class.todos__item--done]': 'item().status === "done"',
  },
  template: `
    <button type="button" class="todos__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
    <input
      class="todos__check"
      type="checkbox"
      [checked]="item().status === 'done'"
      (change)="store.toggleDone(item())"
      [attr.aria-label]="'Отметить: ' + item().title"
    />
    <span class="todos__title">{{ item().title }}</span>
    <!-- Заметка ТЕКСТОМ в той же строке (замечания Elmir 17.08.2026: «заметку пишем, но нигде не
         видим» → «всё в одну строку бы»). Значок «✎» сообщал лишь факт её существования: чтобы
         прочесть «взять паспорт и СНИЛС», надо было открыть детали — продукт спросил и не вернул.
         Длинная обрезается многоточием, целиком — по клику. -->
    @if (item().note) {
      <button
        type="button"
        class="todos__note"
        [title]="item().note ?? ''"
        (click)="store.showNote(item())"
      >
        {{ item().note }}
      </button>
    }
    @if (item().badge) {
      <span class="todos__badge">{{ item().badge }}</span>
    }
    @if (item().waitsForEventId || item().waitsUntil) {
      <span class="todos__wait" [title]="store.waitTitle(item())">
        ⏳ {{ store.waitLabel(item()) }}
      </span>
    }
    @if (item().plannedOn; as day) {
      <span class="todos__date">{{ formatDay(day) }}</span>
    }
    <!-- Вид — последним перед кнопками (замечание Elmir 17.08.2026: «поменять бы местами»):
         слева от заметки он читался как часть текста, а справа выстраивается в ровную колонку и
         отвечает на вопрос «что это» одним взглядом вниз по списку. -->
    <span class="todos__kind" [attr.data-kind]="item().kind">{{ labels[item().kind] }}</span>
    <button
      type="button"
      class="todos__edit"
      (click)="store.toggleArchived(item())"
      [attr.aria-label]="(item().archived ? 'Вернуть из архива: ' : 'В архив: ') + item().title"
      [title]="item().archived ? 'Вернуть из архива' : 'В архив'"
    >
      {{ item().archived ? '↩' : '⇥' }}
    </button>
    <button
      type="button"
      class="todos__edit"
      (click)="store.openDetails(item())"
      [attr.aria-label]="'Детали: ' + item().title"
      title="Детали"
    >
      ⋯
    </button>
    <!-- Глубже предела вкладывать нельзя (бэк откажет), поэтому на последнем уровне кнопки нет:
         предлагать действие, которое кончится ошибкой, — обман. -->
    @if (depth() < maxDepth) {
      <button
        type="button"
        class="todos__sub"
        (click)="store.startSub(item().id)"
        [attr.aria-label]="'Добавить подзадачу к: ' + item().title"
        title="Добавить подзадачу"
      >
        +
      </button>
    }
    <button
      type="button"
      class="todos__remove"
      (click)="store.remove(item())"
      [attr.aria-label]="'Удалить: ' + item().title"
    >
      ×
    </button>

    @if (item().children.length > 0) {
      <ul class="todos__children" cdkDropList (cdkDropListDropped)="dropChild($event)">
        @for (child of item().children; track child.id) {
          <li app-todo-node [item]="child" [depth]="depth() + 1" cdkDrag></li>
        }
      </ul>
    }

    @if (store.subParentId() === item().id) {
      <form class="todos__subform" (submit)="submitSub($event)">
        <input
          class="todos__input"
          type="text"
          [value]="store.subDraftValue()"
          (input)="store.subDraftValue.set($any($event.target).value)"
          placeholder="Подзадача…"
          aria-label="Название подзадачи"
          maxlength="200"
        />
        <app-button type="submit" [disabled]="store.subDraftValue().trim() === ''">
          Добавить
        </app-button>
        <app-button variant="ghost" type="button" (click)="store.cancelSub()">Отмена</app-button>
      </form>
    }
  `,
  styles: [
    `
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

      :host {
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
      :host(.todos__item--done) .todos__title {
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

      :host(.todos__item--child) {
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

      :host {
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

      .todos__note {
        /* Одна строка: список остаётся списком. Хвост уходит в многоточие, целиком — по клику. */
        flex: 1 1 120px;
        min-width: 0;
        border: none;
        background: none;
        padding: 0;
        text-align: left;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
      }

      .todos__note:hover {
        color: var(--color-text);
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
    `,
  ],
})
export class TodoNodeComponent {
  /** Запись, которую рисуем. */
  public readonly item = input.required<TodoView>();
  /** Уровень вложенности, считая от 1 у корня. */
  public readonly depth = input.required<number>();

  /** Состояние и операции экрана — общие на все уровни. */
  protected readonly store = inject(TodosStore);
  /** Человеческий формат дня. */
  protected readonly formatDay = formatDay;
  /** Подписи видов. */
  protected readonly labels = TODO_KIND_LABELS;
  /** Предел вложенности. */
  protected readonly maxDepth = TODO_MAX_DEPTH;

  /**
   * Сохраняет порядок подзадач этой записи.
   * @param event Событие перетаскивания.
   * @returns Ничего.
   */
  protected dropChild(event: CdkDragDrop<unknown>): void {
    this.store.reorder(event, this.item());
  }

  /**
   * Отправка формы подзадачи.
   * @param event Событие формы.
   * @returns Ничего.
   */
  protected submitSub(event: Event): void {
    event.preventDefault();
    this.store.addSub(this.item().id);
  }
}
