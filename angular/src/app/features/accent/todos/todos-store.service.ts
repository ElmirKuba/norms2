import { Injectable, computed, inject, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { AccentApiService } from '../services/accent-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { ModalHeaderClassIcon } from '../../../shared/modals/dialog-modal/dialog-modal.types';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { formatDay } from './format-day.util';
import { groupTodos, todayYmd } from './todo-groups.util';
import { filterTodos } from './todo-filter.util';
import { TodoFormModalComponent } from './todo-form-modal.component';
import { TodoEventsModalComponent } from './todo-events-modal.component';
import type { TodoFormData } from './todo-form-modal.component';
import type { TodoGroup, TodoGroupKey } from './todo-groups.util';
import type { TodoEventView, TodoView } from '../accent.types';

/** Предел вложенности — тот же, что в домене (`MAX_DEPTH`): глубже кнопки «+» не показываем. */
export const TODO_MAX_DEPTH = 3;

/**
 * Сколько живёт предложение отменить, мс.
 *
 * Семь секунд — компромисс: меньше не успеть заметить и дотянуться мышью, больше — полоса
 * начинает висеть над списком как мусор и мешать следующему действию.
 */
const UNDO_MS = 7000;

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
export class TodosStore implements OnDestroy {
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
  /**
   * Сегодняшний день `YYYY-MM-DD` — снимок на момент открытия экрана.
   *
   * Сигналом, а не вызовом `todayYmd()` прямо в `computed`: иначе «сегодня» пересчитывалось бы
   * при каждой правке списка и молча зависело бы от того, трогал ли человек записи после полуночи.
   */
  public readonly today = signal(todayYmd());

  /**
   * Текст полосы отмены или пустая строка (·E3).
   *
   * Смысл механики: обратимое действие происходит **сразу**, а цена ошибки — один клик после,
   * и только если ошибка случилась. Диалог остаётся там, где отменить нельзя (уходит поддерево).
   */
  public readonly undoText = signal('');

  /** Строка поиска (·E2); пустая — фильтр выключен. */
  public readonly query = signal('');

  /** Ищем ли прямо сейчас — при активном поиске часть действий ведёт себя иначе. */
  public readonly searching = computed(() => this.query().trim() !== '');

  /**
   * Записи, прошедшие фильтр поиска. Всё, что видит экран, идёт отсюда, а не из `items`:
   * иначе поиск сузил бы один список и не тронул другой.
   */
  public readonly visible = computed<TodoView[]>(() => filterTodos(this.items(), this.query()));

  /**
   * Записи, разложенные по группам «Просрочено · Сегодня · Скоро · Позже · Ждут · Без даты ·
   * Сделано» (·E1). Пустые группы не приходят.
   *
   * В архиве группировка не применяется: там лежит убранное с глаз, и раскладывать его по срокам
   * незачем — тот экран отвечает на вопрос «что я спрятал», а не «что делать».
   */
  public readonly groups = computed<TodoGroup[]>(() =>
    groupTodos(this.visible(), this.events(), this.today()),
  );

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
    const next = item.status !== 'done';
    this._setDone(item.id, next, () => {
      this._offerUndo(next ? 'Отмечено' : 'Отметка снята', () => {
        this._setDone(item.id, !next);
      });
    });
  }

  /**
   * Отправляет отметку и обновляет строку на месте.
   * @param id Идентификатор записи.
   * @param done Ставим или снимаем отметку.
   * @param onDone Что сделать после успеха (предложить отмену — только у первого вызова, не у
   * отката: иначе полоса отмены отменяла бы саму отмену и человек ходил бы по кругу).
   * @returns Ничего.
   */
  private _setDone(id: string, done: boolean, onDone?: () => void): void {
    this._api.setTodoDone(id, done).subscribe({
      next: (row) => {
        this.items.update((rows) => this._replaceInTree(rows, row));
        onDone?.();
      },
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
    // Уходит поддерево — спрашиваем. Это ровно тот случай, где отмена не спасает: подзадачи
    // уходят каскадом по карте владения (ADR-0068), и человек должен узнать об этом ДО, а не
    // после — «Отменить» вернуло бы ему список, а не уверенность, что вернулось всё.
    if (item.children.length > 0) {
      void this._modal
        .confirm({
          title: 'Удалить запись?',
          text: `«${item.title}» и её подзадачи (${String(item.children.length)}) будут удалены.`,
          confirmText: 'Удалить',
          danger: true,
        })
        .then((ok) => {
          if (ok) {
            this._deleteNow(item.id);
          }
        });
      return;
    }
    // Одиночная запись — сразу с глаз, а запрос ждёт семь секунд. Ждём потому, что ручки
    // «восстановить удалённое» у нас нет: отправь мы DELETE сразу, «Отменить» пришлось бы делать
    // созданием новой записи — с другим идентификатором и потерянным местом в списке.
    this.items.update((rows) => this._removeFromTree(rows, item.id));
    this._offerUndo(
      'Удалено',
      () => {
        this.load();
      },
      () => {
        this._deleteNow(item.id);
      },
    );
  }

  /**
   * Физически удаляет запись.
   * @param id Идентификатор записи.
   * @returns Ничего.
   */
  private _deleteNow(id: string): void {
    this._api.deleteTodo(id).subscribe({
      next: () => this.items.update((rows) => this._removeFromTree(rows, id)),
      error: (err: unknown) => {
        // Запись уже убрана с экрана — возвращаем её, иначе список врёт про содержимое базы.
        this.load();
        this._modal.error('Не удалось удалить', errorMessage(err));
      },
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
    const toArchive = !item.archived;
    this._setArchived(item.id, toArchive, () => {
      this._offerUndo(toArchive ? 'В архиве' : 'Возвращено из архива', () => {
        this._setArchived(item.id, !toArchive, () => {
          // Запись возвращается в текущий режим показа — перечитываем список, чтобы она встала
          // на своё место в группе, а не в конец.
          this.load();
        });
      });
    });
  }

  /**
   * Прячет запись в архив или возвращает её.
   * @param id Идентификатор записи.
   * @param archived Прячем или возвращаем.
   * @param onDone Что сделать после успеха.
   * @returns Ничего.
   */
  private _setArchived(id: string, archived: boolean, onDone?: () => void): void {
    const request = archived ? this._api.archiveTodo(id) : this._api.restoreTodo(id);
    request.subscribe({
      // Запись уходит из текущего списка: она переехала в другой режим показа.
      next: () => {
        this.items.update((rows) => this._removeFromTree(rows, id));
        onDone?.();
      },
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
   * Сохраняет новый порядок подзадач.
   *
   * Корневой уровень переставляется через {@link reorderInGroup}: там записи разложены по
   * группам, и общий порядок собирается из них.
   * @param event Событие перетаскивания.
   * @param parent Родитель уровня.
   * @returns Ничего.
   */
  public reorder(event: CdkDragDrop<unknown>, parent: TodoView): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...parent.children];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.update((rows) => this._replaceChildren(rows, parent.id, next));
    this._save(next);
  }

  /**
   * Сохраняет новый порядок внутри группы корневого уровня.
   *
   * **На сервер уходит весь корневой порядок, а не одна группа.** Позиция сквозная по уровню, и
   * отправь мы только переставленную группу — её записи получили бы `0..n`, пересекающиеся с
   * позициями соседних групп. Пока группы нарисованы отдельно, этого не видно, но стоит делу
   * сменить группу (наступил срок, состоялось событие) — и оно встанет в произвольное место.
   * @param event Событие перетаскивания.
   * @param key Ключ группы, внутри которой тащили.
   * @returns Ничего.
   */
  public reorderInGroup(event: CdkDragDrop<unknown>, key: TodoGroupKey): void {
    // Под фильтром порядок не сохраняем: на сервер ушёл бы порядок ВИДИМЫХ записей, а
    // невидимые сохранили бы старые позиции — список перемешался бы после сброса поиска.
    // Перетаскивание в это время и отключено в шаблоне; проверка здесь — вторая застёжка.
    if (event.previousIndex === event.currentIndex || this.searching()) {
      return;
    }
    const next = this.groups().flatMap((group) => {
      if (group.key !== key) {
        return group.items;
      }
      const moved = [...group.items];
      moveItemInArray(moved, event.previousIndex, event.currentIndex);
      return moved;
    });
    this.items.set(next);
    this._save(next);
  }

  /**
   * Сохраняет новый порядок в архиве: там список плоский, группы не рисуются.
   * @param event Событие перетаскивания.
   * @returns Ничего.
   */
  public reorderArchived(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex || this.searching()) {
      return;
    }
    const next = [...this.items()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.set(next);
    this._save(next);
  }

  /**
   * Отправляет порядок уровня на сервер.
   *
   * Оптимистично: список уже переставлен, запрос уходит следом. Ошибка — перезагружаем с сервера
   * и говорим об этом: молча оставить порядок, которого нет в базе, хуже, чем откатить.
   * @param rows Записи уровня в новом порядке.
   * @returns Ничего.
   */
  private _save(rows: TodoView[]): void {
    this._api.reorderTodos(rows.map((row) => row.id)).subscribe({
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
   * Что сделать, если человек нажал «Отменить».
   *
   * Хранится полем, а не сигналом: это колбэк, от него ничего не перерисовывается, а лишний
   * сигнал заставил бы шаблон реагировать на смену функции.
   */
  private _undoRevert: (() => void) | null = null;

  /**
   * Что сделать, когда время вышло, — отложенный запрос.
   *
   * Есть только у удаления: отметку и архив можно выполнить сразу и откатить обратным вызовом,
   * а удалённую запись вернуть **нечем на уровне продукта** — ручки восстановления нет. Строка,
   * правда, не стирается: хранилище проставляет ей `deleted_at` и убирает из всех выборок
   * (ADR-0068), но домен искренне считает, что удалил, и обратного пути не предлагает. Поэтому
   * DELETE **не уходит** семь секунд, и всё это время запись просто спрятана с экрана.
   */
  private _undoCommit: (() => void) | null = null;

  /** Таймер полосы отмены. */
  private _undoTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Экран закрывают — отложенное нельзя оставлять висеть: выполняем немедленно.
   *
   * Иначе человек удалил запись, ушёл с экрана в ту же секунду — и запрос не ушёл бы никогда,
   * а запись «воскресла» бы при следующем открытии списка.
   * @returns Ничего.
   */
  public ngOnDestroy(): void {
    this._commitUndo();
  }

  /**
   * Отменяет последнее действие.
   * @returns Ничего.
   */
  public undo(): void {
    const revert = this._undoRevert;
    this._clearUndo();
    revert?.();
  }

  /**
   * Предлагает отмену и заводит таймер.
   * @param text Что произошло — короткой фразой в прошедшем времени.
   * @param revert Как вернуть как было.
   * @param commit Что доделать по истечении времени (только у отложенного удаления).
   * @returns Ничего.
   */
  private _offerUndo(text: string, revert: () => void, commit: (() => void) | null = null): void {
    // Предыдущее отложенное доводим до конца немедленно: двух ожидающих удалений быть не должно,
    // иначе «Отменить» стало бы неоднозначным — какое из них оно отменяет.
    this._commitUndo();
    this._undoRevert = revert;
    this._undoCommit = commit;
    this.undoText.set(text);
    this._undoTimer = setTimeout(() => this._commitUndo(), UNDO_MS);
  }

  /**
   * Время вышло (или пришло новое действие): доводим отложенное до конца.
   * @returns Ничего.
   */
  private _commitUndo(): void {
    const commit = this._undoCommit;
    this._clearUndo();
    commit?.();
  }

  /**
   * Гасит полосу и забывает колбэки.
   * @returns Ничего.
   */
  private _clearUndo(): void {
    if (this._undoTimer !== null) {
      clearTimeout(this._undoTimer);
      this._undoTimer = null;
    }
    this._undoRevert = null;
    this._undoCommit = null;
    this.undoText.set('');
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
