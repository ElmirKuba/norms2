import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { AccentTimerModalComponent } from '../shared/accent-timer-modal.component';
import type { AccentTimerData, AccentTimerResult } from '../shared/accent-timer-modal.component';
import { ObstacleFormModalComponent } from './obstacle-form-modal.component';
import type { ObstacleFormData } from './obstacle-form-modal.component';
import { ObstacleEncounterModalComponent } from './obstacle-encounter-modal.component';
import type {
  EncounterModalData,
  EncounterModalResult,
} from './obstacle-encounter-modal.component';
import {
  counterplaysLabel,
  encountersLabel,
  obstacleTypeIcon,
  obstacleTypeLabel,
} from './obstacle-format.util';
import type { CounterplayView, MicroWinView, ObstaclePayload, ObstacleView } from '../accent.types';

/**
 * Экран «Препятствия» (`/accent/obstacles`): карта того, что мешает, — с заранее
 * заготовленными ответами. Препятствие здесь не свойство характера, а объект с именем,
 * поводом и контрмерами (ADR-0062).
 *
 * Тон: список «что мешает», а не «твои слабости»; частота — информация для приоритета, а не
 * счётчик позора. Тонкий слой над `AccentApiService`.
 */
@Component({
  selector: 'app-obstacles',
  imports: [
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ob">
      <header class="ob__head">
        <h2>Препятствия</h2>
        <span class="tooltip-host" [attr.data-tooltip]="'Добавить препятствие'">
          <app-button ariaLabel="Добавить препятствие" (click)="openCreate()">+</app-button>
        </span>
      </header>

      <aside class="ob__why">
        <span class="ob__why-icon" aria-hidden="true">🧭</span>
        <p class="ob__why-text">
          <strong>Что мешает — и что с этим делать.</strong> Когда накрывает, придумывать решение
          нечем. Поэтому ответы готовятся заранее, на холодную голову, и лежат здесь — чтобы в
          нужную минуту просто выбрать из своего.
        </p>
      </aside>

      @if (loading()) {
        <p class="ob__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="ob__error">{{ error() }}</p>
      } @else if (items().length === 0) {
        <app-empty-state
          title="Пока пусто"
          text="Назови то, что чаще всего сбивает тебя с пути, — и заготовь пару ответов на него заранее."
        >
          <app-button (click)="openCreate()">
            <span aria-hidden="true">➕</span>
            Добавить препятствие
          </app-button>
        </app-empty-state>
      } @else {
        @if (softLimitExceeded()) {
          <p class="ob__hint">
            Много фронтов сразу — может, часть убрать в архив? Это не запрет, просто наблюдение:
            силы конечны.
          </p>
        }
        <ul class="ob__list" cdkDropList (cdkDropListDropped)="dropObstacle($event)">
          @for (o of items(); track o.id) {
            <li cdkDrag>
              <app-card>
                <div class="ob__item">
                  <button type="button" class="ob__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                  <a class="ob__main ob__link" [routerLink]="[o.id]">
                    <span class="ob__name-row">
                      <span class="ob__type-ico" aria-hidden="true">{{ typeIcon(o.type) }}</span>
                      <strong class="ob__name">{{ o.name }}</strong>
                      @if (o.isStarter) {
                        <span class="ob__badge">пример</span>
                      }
                    </span>
                    <span class="ob__sub">
                      <span class="ob__type">{{ typeLabel(o.type) }}</span>
                      <span class="ob__dot" aria-hidden="true">·</span>
                      <span class="ob__stat">{{ encounters(o) }}</span>
                      <span class="ob__dot" aria-hidden="true">·</span>
                      <span class="ob__stat">{{ counterplays(o) }}</span>
                    </span>
                    @if (o.trigger) {
                      <span class="ob__trigger">когда: {{ o.trigger }}</span>
                    }
                  </a>
                  <div class="ob__right">
                    @if (!o.isStarter) {
                      <span class="tooltip-host" [attr.data-tooltip]="'Отметить столкновение и выбрать ответ'">
                        <app-button
                          variant="ghost"
                          ariaLabel="Столкнулся"
                          [loading]="encounterBusyId() === o.id"
                          (click)="openEncounter(o)"
                        >⚡</app-button>
                      </span>
                    }
                    <span class="ob__intensity" [attr.title]="'Насколько давит: ' + o.intensity + ' из 5'">
                      {{ pressure(o.intensity) }}
                    </span>
                    <div class="ob__menu-wrap">
                      <span class="tooltip-host" [attr.data-tooltip]="'Дополнительные опции'">
                        <button
                          type="button"
                          class="ob__menu-btn"
                          aria-label="Дополнительные опции"
                          (click)="toggleMenu(o.id, $event)"
                        >⋯</button>
                      </span>
                      @if (openMenuId() === o.id) {
                        <div class="ob__menu" (click)="$event.stopPropagation()">
                          <button type="button" class="ob__menu-item" (click)="openEdit(o); closeMenu()">
                            <span class="ob__menu-ico" aria-hidden="true">✏️</span>
                            Изменить
                          </button>
                          <button
                            type="button"
                            class="ob__menu-item ob__menu-item--danger"
                            (click)="archive(o); closeMenu()"
                          >
                            <span class="ob__menu-ico" aria-hidden="true">📦</span>
                            Убрать из списка
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </app-card>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .ob {
        padding: var(--space-4) 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .ob__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .ob__why {
        display: flex;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
      }
      .ob__why-text {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ob__hint {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ob__muted {
        color: var(--color-text-muted);
      }
      .ob__error {
        color: var(--color-danger);
      }
      .ob__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .ob__item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .ob__grip {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        cursor: grab;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
      }
      .ob__grip:active {
        cursor: grabbing;
      }
      .ob__link {
        text-decoration: none;
        color: inherit;
        flex: 1 1 auto;
      }
      .ob__link:hover .ob__name {
        color: var(--color-accent);
      }
      .ob__main {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }
      .ob__name-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .ob__name {
        font-size: var(--fs-md);
      }
      .ob__badge {
        padding: 0 var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-surface-3, var(--color-surface-2));
        border: 1px solid var(--color-border);
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .ob__sub {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ob__dot {
        opacity: 0.5;
      }
      .ob__trigger {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .ob__right {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
      }
      .ob__intensity {
        letter-spacing: 1px;
        font-size: var(--fs-sm);
      }
      .ob__menu-wrap {
        position: relative;
      }
      .ob__menu-btn {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        font-size: var(--fs-lg);
        cursor: pointer;
        border-radius: var(--radius-sm);
      }
      .ob__menu-btn:hover {
        background: var(--color-surface-2);
        color: var(--color-text);
      }
      .ob__menu {
        position: absolute;
        right: 0;
        top: 100%;
        z-index: 5;
        min-width: 12rem;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        box-shadow: var(--shadow-md, 0 8px 24px rgb(0 0 0 / 25%));
        overflow: hidden;
      }
      .ob__menu-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: none;
        background: transparent;
        color: var(--color-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .ob__menu-item:hover {
        background: var(--color-surface-2);
      }
      .ob__menu-item--danger {
        color: var(--color-danger);
      }
    `,
  ],
})
export class ObstaclesComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);

  /** Препятствия в ручном порядке. */
  protected readonly items = signal<ObstacleView[]>([]);
  /** Активных больше мягкого порога — показать подсказку (не запрет). */
  protected readonly softLimitExceeded = signal(false);
  /** Идёт загрузка списка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки. */
  protected readonly error = signal<string | null>(null);
  /** Id карточки с открытым меню «⋯» или null. */
  protected readonly openMenuId = signal<string | null>(null);
  /** Id препятствия, по которому идёт запись столкновения. */
  protected readonly encounterBusyId = signal<string | null>(null);
  /** Кеш микро-побед (грузится лениво — нужен только для запуска таймера). */
  private readonly _microWins = signal<MicroWinView[] | null>(null);

  public constructor() {
    this.reload();
  }

  /** Закрывает меню «⋯» по клику мимо него. */
  @HostListener('document:click')
  protected closeMenu(): void {
    this.openMenuId.set(null);
  }

  /**
   * Открывает/закрывает меню карточки.
   * @param id Идентификатор препятствия.
   * @param event Событие клика (гасим, чтобы не сработал глобальный закрыватель).
   */
  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  /** Перезагружает список. */
  protected reload(): void {
    this.loading.set(true);
    this._api.listObstacles().subscribe({
      next: (list) => {
        this.items.set(list.items);
        this.softLimitExceeded.set(list.softLimitExceeded);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Открывает форму создания; список обновляется точечно, без перезагрузки экрана. */
  protected openCreate(): void {
    const data: ObstacleFormData = {
      submit: (payload: ObstaclePayload) => this._api.createObstacle(payload),
    };
    this._dialog
      .open<ObstacleFormModalComponent, ObstacleFormData, ObstaclePayload | null>(
        ObstacleFormModalComponent,
        { width: MODAL_SMALL_WIDTH, data },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.reload();
        }
      });
  }

  /**
   * Открывает форму правки. Правка примера присваивает его (ADR-0051).
   * @param obstacle Препятствие.
   */
  protected openEdit(obstacle: ObstacleView): void {
    const data: ObstacleFormData = {
      obstacle,
      submit: (payload: ObstaclePayload) => this._api.updateObstacle(obstacle.id, payload),
    };
    this._dialog
      .open<ObstacleFormModalComponent, ObstacleFormData, ObstaclePayload | null>(
        ObstacleFormModalComponent,
        { width: MODAL_SMALL_WIDTH, data },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.reload();
        }
      });
  }

  /**
   * Убирает препятствие из списка (архив; история цела — это не удаление).
   * @param obstacle Препятствие.
   */
  protected archive(obstacle: ObstacleView): void {
    this._api.updateObstacle(obstacle.id, { isActive: false }).subscribe({
      next: () => this.items.update((list) => list.filter((o) => o.id !== obstacle.id)),
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }

  /**
   * Перетаскивание карточек (ADR-0054): порядок применяем оптимистично, при ошибке
   * перечитываем список — врать о сохранённом порядке нельзя.
   * @param event Событие CDK.
   */
  protected dropObstacle(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.items()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.set(next);
    this._api.reorderObstacles(next.map((o) => o.id)).subscribe({
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.reload();
      },
    });
  }

  /**
   * «Столкнулся» прямо из списка: подтягиваем ответы этого препятствия и открываем тот же
   * поток, что и на детали. Один тап от карточки до действия — ради этого раздел и нужен.
   * @param obstacle Препятствие.
   */
  protected openEncounter(obstacle: ObstacleView): void {
    if (this.encounterBusyId() !== null) {
      return;
    }
    this.encounterBusyId.set(obstacle.id);
    this._api.listCounterplays(obstacle.id).subscribe({
      next: (counterplays) => {
        this.encounterBusyId.set(null);
        this._openEncounterDialog(obstacle, counterplays);
      },
      error: (err: unknown) => {
        this.encounterBusyId.set(null);
        this.error.set(errorMessage(err));
      },
    });
  }

  /**
   * Показывает выбор ответа и записывает столкновение.
   * @param obstacle Препятствие.
   * @param counterplays Заготовленные ответы.
   */
  private _openEncounterDialog(
    obstacle: ObstacleView,
    counterplays: readonly CounterplayView[],
  ): void {
    const data: EncounterModalData = { obstacleName: obstacle.name, counterplays };
    this._dialog
      .open<ObstacleEncounterModalComponent, EncounterModalData, EncounterModalResult | null>(
        ObstacleEncounterModalComponent,
        { width: MODAL_SMALL_WIDTH, data },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.encounterBusyId.set(obstacle.id);
        this._api
          .recordEncounter(obstacle.id, {
            counterplayId: result.counterplayId,
            note: result.note,
          })
          .subscribe({
            next: (recorded) => {
              // Карточка приходит со свежими счётчиками — обновляем точечно, без перезагрузки.
              this.items.update((list) =>
                list.map((o) => (o.id === recorded.obstacle.id ? recorded.obstacle : o)),
              );
              this.encounterBusyId.set(null);
              const chosen = counterplays.find((c) => c.id === result.counterplayId);
              if (chosen?.linkedMicroWinId) {
                this._startTimer(chosen.linkedMicroWinId);
              }
            },
            error: (err: unknown) => {
              this.error.set(errorMessage(err));
              this.encounterBusyId.set(null);
            },
          });
      });
  }

  /**
   * Открывает таймер привязанной микро-победы (каталог грузим лениво — он нужен только здесь).
   * @param microWinId Идентификатор микро-победы.
   */
  private _startTimer(microWinId: string): void {
    const cached = this._microWins();
    if (cached === null) {
      this._api.listMicroWins().subscribe({
        next: (list) => {
          this._microWins.set(list);
          this._openTimer(list, microWinId);
        },
        error: () => this._microWins.set([]),
      });
      return;
    }
    this._openTimer(cached, microWinId);
  }

  /**
   * Показывает таймер и по завершении засчитывает микро-победу.
   * @param microWins Каталог микро-побед.
   * @param microWinId Идентификатор нужной.
   */
  private _openTimer(microWins: readonly MicroWinView[], microWinId: string): void {
    const microWin = microWins.find((mw) => mw.id === microWinId);
    if (!microWin) {
      return;
    }
    this._dialog
      .open<AccentTimerModalComponent, AccentTimerData, AccentTimerResult | null>(
        AccentTimerModalComponent,
        {
          width: MODAL_SMALL_WIDTH,
          panelClass: 'modal-flush',
          disableClose: true,
          data: {
            title: microWin.title,
            durationSeconds: microWin.durationSeconds,
            prepSeconds: microWin.prepSeconds,
            mode: 'binary',
          },
        },
      )
      .afterClosed()
      .subscribe((timer) => {
        if (timer?.status === 'done') {
          this._api.completeMicroWin(microWin.id).subscribe({
            error: (err: unknown) => this.error.set(errorMessage(err)),
          });
        }
      });
  }

  /**
   * Иконка вида препятствия.
   * @param type Вид.
   * @returns Эмодзи.
   */
  protected typeIcon(type: ObstacleView['type']): string {
    return obstacleTypeIcon(type);
  }

  /**
   * Ярлык вида препятствия.
   * @param type Вид.
   * @returns Человеческое название.
   */
  protected typeLabel(type: ObstacleView['type']): string {
    return obstacleTypeLabel(type);
  }

  /**
   * Подпись частоты («мешал N раз за месяц»).
   * @param obstacle Препятствие.
   * @returns Подпись.
   */
  protected encounters(obstacle: ObstacleView): string {
    return encountersLabel(obstacle.encountersLast30);
  }

  /**
   * Подпись числа заготовленных ответов.
   * @param obstacle Препятствие.
   * @returns Подпись.
   */
  protected counterplays(obstacle: ObstacleView): string {
    return counterplaysLabel(obstacle.counterplaysCount);
  }

  /**
   * Визуальная шкала «насколько давит» точками — мягче цифры и не читается как оценка.
   * @param intensity Значение 1..5.
   * @returns Строка вида «●●●○○».
   */
  protected pressure(intensity: number): string {
    const filled = Math.max(0, Math.min(5, intensity));
    return '●'.repeat(filled) + '○'.repeat(5 - filled);
  }
}
