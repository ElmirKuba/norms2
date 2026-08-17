import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { AccentApiService } from '../services/accent-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { ModalHeaderClassIcon } from '../../../shared/modals/dialog-modal/dialog-modal.types';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { formatDay } from './format-day.util';
import { TodoFormModalComponent } from './todo-form-modal.component';
import { TodoEventsModalComponent } from './todo-events-modal.component';
import type { TodoFormData } from './todo-form-modal.component';
import type { TodoEventView, TodoView } from '../accent.types';

/** Предел вложенности — тот же, что в домене (`MAX_DEPTH`): глубже кнопки «+» не показываем. */
export const TODO_MAX_DEPTH = 3;

/**
 * Состояние и операции экрана «Дела».
 *
 * **Почему сервис, а не поля компонента.** Узел списка стал отдельным компонентом (иначе
 * перетаскивание не работает: CDK связывает элемент со списком через DI, а не через DOM, и
 * элементы из `ngTemplateOutlet` оставались без своего списка). Узел рекурсивен, поэтому колбэки
 * пришлось бы пробрасывать через все три уровня — а любой пропущенный проброс молча ломает
 * действие ровно на одном уровне вложенности.
 *
 * Предоставляется самим экраном (`providers` компонента), а не в корне: состояние живёт ровно
 * столько, сколько открыт список.
 */
@Injectable()
export class TodosStore {
  private readonly _api = inject(AccentApiService);
  private readonly _modal = inject(ModalService);
  private readonly _dialog = inject(MatDialog);

  /** Записи списка. */
  public readonly items = signal<TodoView[]>([]);
  /** События справочника — чтобы подписать ожидание названием, а не идентификатором. */
  public readonly events = signal<TodoEventView[]>([]);
  /** Идёт загрузка. */
  public readonly loading = signal(true);
  /** Текст ошибки или пустая строка. */
  public readonly error = signal('');
  /** Показывать архив вместо живых записей. */
  public readonly archived = signal(false);
  /** Идентификатор записи, под которой открыта форма подзадачи, или null. */
  public readonly subParentId = signal<string | null>(null);
  /** Черновик подзадачи. */
  public readonly subDraftValue = signal('');

  /**
   * Загружает записи.
   * @returns Ничего; результат складывается в сигналы.
   */
  public load(): void {
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
   * Подтягивает справочник событий (включая состоявшиеся): подпись «ждёт X» должна остаться
   * читаемой и после того, как событие случилось, — до перезагрузки списка.
   * @returns Ничего.
   */
  public loadEvents(): void {
    this._api.listTodoEvents(true).subscribe({
      next: (rows) => this.events.set(rows),
      error: () => this.events.set([]),
    });
  }

  /**
   * Добавляет корневую запись.
   * @param title Заголовок.
   * @param onDone Что сделать после успеха (вернуть фокус в поле).
   * @param onError Что сделать при ошибке.
   * @returns Ничего.
   */
  public add(title: string, onDone: () => void, onError: (message: string) => void): void {
    this._api.createTodo({ kind: 'deed', title }).subscribe({
      // Дописываем в конец: порядок ввода = порядок в списке, ничего не «прыгает».
      next: (row) => {
        this.items.update((rows) => [...rows, row]);
        onDone();
      },
      error: (err: unknown) => onError(errorMessage(err, 'Не удалось добавить запись.')),
    });
  }

  /**
   * Переключает отметку выполнения.
   * @param item Запись.
   * @returns Ничего.
   */
  public toggleDone(item: TodoView): void {
    this._api.setTodoDone(item.id, item.status !== 'done').subscribe({
      next: (row) => this.items.update((rows) => this._replaceInTree(rows, row)),
      error: (err: unknown) => this._modal.error('Не удалось отметить', errorMessage(err)),
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
  public remove(item: TodoView): void {
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
          next: () => this.items.update((rows) => this._removeFromTree(rows, item.id)),
          error: (err: unknown) => this._modal.error('Не удалось удалить', errorMessage(err)),
        });
      });
  }

  /**
   * Прячет запись в архив или возвращает её.
   *
   * Архив — не удаление: у спрятанного обязан быть экран, где его видно, и способ вернуть.
   * Здесь это переключатель «Живые ↔ Архив» рядом со списком.
   * @param item Запись.
   * @returns Ничего.
   */
  public toggleArchived(item: TodoView): void {
    const request = item.archived ? this._api.restoreTodo(item.id) : this._api.archiveTodo(item.id);
    request.subscribe({
      // Запись уходит из текущего списка: она переехала в другой режим показа.
      next: () => this.items.update((rows) => this._removeFromTree(rows, item.id)),
      error: (err: unknown) => this._modal.error('Не удалось перенести', errorMessage(err)),
    });
  }

  /**
   * Открывает детали записи: вид, заметка, метка, назначенный день, ожидание.
   *
   * Форма сама зовёт API и закрывается только при успехе — при ошибке остаётся открытой, и
   * набранный текст не теряется.
   * @param item Запись.
   * @returns Ничего.
   */
  public openDetails(item: TodoView): void {
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
          this.loadEvents();
        }
      });
  }

  /**
   * Открывает справочник событий.
   *
   * После закрытия перечитываем список: событие могло состояться, и тогда часть дел перестала
   * ждать — экран обязан это показать, иначе человек будет видеть ожидание, которого уже нет.
   * @returns Ничего.
   */
  public openEvents(): void {
    void this._dialog
      .open(TodoEventsModalComponent, { width: MODAL_SMALL_WIDTH, autoFocus: false })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) {
          this.load();
          this.loadEvents();
        }
      });
  }

  /**
   * Показывает заметку целиком.
   *
   * Обрезанная строка отвечает на вопрос «есть ли тут что-то и про что оно», а полный текст нужен
   * редко — поэтому окно, а не разворачивание списка.
   * @param item Запись.
   * @returns Ничего.
   */
  public showNote(item: TodoView): void {
    this._modal.message(item.title, ModalHeaderClassIcon.Info, item.note ?? '');
  }

  /**
   * Открывает или закрывает форму подзадачи под записью.
   * @param parentId Идентификатор родителя.
   * @returns Ничего.
   */
  public startSub(parentId: string): void {
    this.subParentId.set(this.subParentId() === parentId ? null : parentId);
    this.subDraftValue.set('');
  }

  /**
   * Закрывает форму подзадачи.
   * @returns Ничего.
   */
  public cancelSub(): void {
    this.subParentId.set(null);
    this.subDraftValue.set('');
  }

  /**
   * Добавляет подзадачу. Форма остаётся открытой — подзадачи чаще всего заводят пачкой
   * («оплатить пошлину», «сдать документы», «забрать»).
   * @param parentId Идентификатор родителя.
   * @returns Ничего.
   */
  public addSub(parentId: string): void {
    const title = this.subDraftValue().trim();
    if (title === '') {
      return;
    }
    this._api.createTodo({ kind: 'deed', title, parentId }).subscribe({
      next: (row) => {
        this.items.update((rows) => this._appendChild(rows, parentId, row));
        this.subDraftValue.set('');
      },
      error: (err: unknown) =>
        this._modal.error('Не удалось добавить подзадачу', errorMessage(err)),
    });
  }

  /**
   * Сохраняет новый порядок на любом уровне.
   *
   * Оптимистично: список переставляется сразу, запрос уходит следом. Ошибка — перезагружаем с
   * сервера и говорим об этом: молча оставить порядок, которого нет в базе, хуже, чем откатить.
   * @param event Событие перетаскивания.
   * @param parent Родитель уровня или `null` для корня.
   * @returns Ничего.
   */
  public reorder(event: CdkDragDrop<unknown>, parent: TodoView | null): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...(parent === null ? this.items() : parent.children)];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    if (parent === null) {
      this.items.set(next);
    } else {
      this.items.update((rows) => this._replaceChildren(rows, parent.id, next));
    }
    this._api.reorderTodos(next.map((row) => row.id)).subscribe({
      error: (err: unknown) => {
        this.load();
        this._modal.error('Не удалось сохранить порядок', errorMessage(err));
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
  public waitLabel(item: TodoView): string {
    const event = this.events().find((row) => row.id === item.waitsForEventId);
    if (event) {
      return event.expectedOn === null
        ? event.title
        : `${event.title}, ${formatDay(event.expectedOn)}`;
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
  public waitTitle(item: TodoView): string {
    const parts = [this.waitLabel(item)];
    if (item.waitsUntil !== null && item.waitsForEventId !== null) {
      parts.push(`не раньше ${formatDay(item.waitsUntil)}`);
    }
    return `Ждёт: ${parts.join(' · ')}`;
  }

  /**
   * Заменяет запись в дереве, где бы она ни лежала, и пересортировывает её уровень.
   *
   * **Обход, а не «корень или прямой ребёнок»**: уровней три, и пара случаев молча не находила бы
   * запись на третьем — отметка уходила бы на сервер, а экран оставался прежним.
   * @param rows Текущий уровень дерева.
   * @param updated Обновлённая запись.
   * @returns Новый уровень с заменой.
   */
  private _replaceInTree(rows: TodoView[], updated: TodoView): TodoView[] {
    let hit = false;
    const next = rows.map((row) => {
      if (row.id === updated.id) {
        hit = true;
        // Дети приходят с сервера пустыми у точечных ручек — сохраняем те, что уже показаны.
        return { ...updated, children: row.children };
      }
      return { ...row, children: this._replaceInTree(row.children, updated) };
    });
    return hit ? this._sorted(next) : next;
  }

  /**
   * Убирает запись из дерева, где бы она ни лежала.
   * @param rows Текущий уровень дерева.
   * @param id Идентификатор удаляемой.
   * @returns Новый уровень без неё.
   */
  private _removeFromTree(rows: TodoView[], id: string): TodoView[] {
    return rows
      .filter((row) => row.id !== id)
      .map((row) => ({ ...row, children: this._removeFromTree(row.children, id) }));
  }

  /**
   * Добавляет ребёнка нужному родителю на любом уровне.
   * @param rows Текущий уровень дерева.
   * @param parentId Идентификатор родителя.
   * @param child Новая запись.
   * @returns Новый уровень с добавленной подзадачей.
   */
  private _appendChild(rows: TodoView[], parentId: string, child: TodoView): TodoView[] {
    return rows.map((row) =>
      row.id === parentId
        ? { ...row, children: [...row.children, child] }
        : { ...row, children: this._appendChild(row.children, parentId, child) },
    );
  }

  /**
   * Подменяет детей у записи на любом уровне (после перетаскивания).
   * @param rows Текущий уровень дерева.
   * @param parentId Идентификатор родителя.
   * @param children Новый порядок детей.
   * @returns Новый уровень.
   */
  private _replaceChildren(
    rows: TodoView[],
    parentId: string,
    children: TodoView[],
  ): TodoView[] {
    return rows.map((row) =>
      row.id === parentId
        ? { ...row, children }
        : { ...row, children: this._replaceChildren(row.children, parentId, children) },
    );
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
}
