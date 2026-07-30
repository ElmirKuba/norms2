import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import { errorMessage } from '../../../core/http/error-message.util';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { AccentApiService } from '../services/accent-api.service';
import { AccentTimerModalComponent } from '../shared/accent-timer-modal.component';
import type { AccentTimerData, AccentTimerResult } from '../shared/accent-timer-modal.component';
import { ObstacleEncounterModalComponent } from './obstacle-encounter-modal.component';
import type {
  EncounterModalData,
  EncounterModalResult,
} from './obstacle-encounter-modal.component';
import {
  counterplaysLabel,
  effectivenessLabel,
  encounterWhen,
  encountersLabel,
  obstacleTypeIcon,
  obstacleTypeLabel,
  outcomeLabel,
} from './obstacle-format.util';
import type {
  CounterplayView,
  EncounterOutcome,
  MicroWinView,
  ObstacleEncounterView,
  ObstacleView,
} from '../accent.types';

/**
 * Экран препятствия (`/accent/obstacles/:id`). **Контрмеры стоят выше описания** — это не
 * паспорт проблемы, а ответ на вопрос «что делать сейчас» (ADR-0062, ui-ux §6). Ниже —
 * повод, признаки и «насколько давит».
 *
 * Контрмеру можно привязать к микро-победе: тогда в момент столкновения (·24) она запускается
 * таймером. Действенность («помогало N из M») показывается подсказкой, но **порядок остаётся
 * ручным** — список не должен прыгать под руками.
 */
@Component({
  selector: 'app-obstacle-detail',
  imports: [
    RouterLink,
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    CardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="obd">
      <a class="obd__back" routerLink="..">← К препятствиям</a>

      @if (loading()) {
        <p class="obd__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="obd__error">{{ error() }}</p>
      } @else if (item(); as o) {
        <header class="obd__head">
          <span class="obd__type-ico" aria-hidden="true">{{ typeIcon(o.type) }}</span>
          <div class="obd__title-wrap">
            <h2 class="obd__title">{{ o.name }}</h2>
            <span class="obd__sub">
              {{ typeLabel(o.type) }}
              <span class="obd__dot" aria-hidden="true">·</span>
              {{ encountersText(o) }}
            </span>
          </div>
          @if (o.isStarter) {
            <span class="obd__badge">пример</span>
          } @else {
            <app-button [loading]="encounterBusy()" (click)="openEncounter()">
              <span aria-hidden="true">⚡</span> Столкнулся
            </app-button>
          }
        </header>

        <app-card>
          <h3 class="obd__section">Что я делаю, когда накрывает</h3>
          @if (counterplays().length === 0) {
            <p class="obd__muted">
              Ответов пока нет. Заготовь один-два сейчас, на холодную голову, — в нужную минуту
              придумывать будет нечем.
            </p>
          } @else {
            <ul class="obd__cps" cdkDropList (cdkDropListDropped)="dropCounterplay($event)">
              @for (c of counterplays(); track c.id) {
                <li class="obd__cp" cdkDrag>
                  @if (editingId() === c.id) {
                    <div class="obd__cp-edit">
                      <input
                        class="obd__input"
                        type="text"
                        maxlength="500"
                        [(ngModel)]="editText"
                        (keydown.enter)="saveEdit(c)"
                      />
                      <select class="obd__input obd__select" [(ngModel)]="editLink">
                        <option value="">Без таймера</option>
                        @for (mw of microWins(); track mw.id) {
                          <option [value]="mw.id">⏱ {{ mw.title }}</option>
                        }
                      </select>
                      <div class="obd__cp-actions">
                        <app-button [loading]="busy()" (click)="saveEdit(c)">Сохранить</app-button>
                        <app-button variant="ghost" (click)="cancelEdit()">Отмена</app-button>
                      </div>
                    </div>
                  } @else {
                    <div class="obd__cp-row">
                      <button type="button" class="obd__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                      <div class="obd__cp-main">
                        <span class="obd__cp-text">{{ c.text }}</span>
                        <span class="obd__cp-meta">
                          @if (c.linkedMicroWinId) {
                            <span class="obd__cp-timer">⏱ {{ microWinTitle(c.linkedMicroWinId) }}</span>
                          }
                          @if (effectiveness(c); as eff) {
                            <span class="obd__cp-eff">{{ eff }}</span>
                          }
                        </span>
                      </div>
                      <div class="obd__cp-actions">
                        <button type="button" class="obd__icon-btn" aria-label="Изменить" (click)="startEdit(c)">✏️</button>
                        <button type="button" class="obd__icon-btn" aria-label="Удалить" (click)="removeCounterplay(c)">🗑</button>
                      </div>
                    </div>
                  }
                </li>
              }
            </ul>
          }

          @if (o.isStarter) {
            <p class="obd__muted obd__starter-note">
              Это пример — «Добавить себе» на экране списка, и можно будет дополнять своими ответами.
            </p>
          } @else {
            <div class="obd__add">
              <input
                class="obd__input"
                type="text"
                maxlength="500"
                placeholder="Например: убрать телефон в другую комнату"
                [(ngModel)]="newText"
                (keydown.enter)="addCounterplay()"
              />
              <select class="obd__input obd__select" [(ngModel)]="newLink">
                <option value="">Без таймера</option>
                @for (mw of microWins(); track mw.id) {
                  <option [value]="mw.id">⏱ {{ mw.title }}</option>
                }
              </select>
              <app-button [loading]="busy()" [disabled]="newText.trim() === ''" (click)="addCounterplay()">
                <span aria-hidden="true">➕</span> Добавить ответ
              </app-button>
            </div>
            <p class="obd__hint">
              Привяжешь микро-победу — в момент столкновения она запустится таймером, без похода в
              другой раздел.
            </p>
          }
        </app-card>

        <app-card>
          <h3 class="obd__section">О препятствии</h3>
          <dl class="obd__facts">
            @if (o.trigger) {
              <dt>Когда приходит</dt>
              <dd>{{ o.trigger }}</dd>
            }
            @if (o.symptoms) {
              <dt>Как узнаю</dt>
              <dd>{{ o.symptoms }}</dd>
            }
            <dt>Насколько давит</dt>
            <dd>{{ pressure(o.intensity) }} <span class="obd__muted">({{ o.intensity }} из 5, самооценка на сегодня)</span></dd>
            <dt>Ответов заготовлено</dt>
            <dd>{{ counterplaysText() }}</dd>
          </dl>
        </app-card>

        @if (!o.isStarter) {
          <app-card>
            <h3 class="obd__section">Когда сталкивался</h3>
            @if (encounters().length === 0) {
              <p class="obd__muted">
                Пока ничего не отмечено. Нажми «Столкнулся» в момент, когда оно придёт, — и здесь
                появится история.
              </p>
            } @else {
              <ul class="obd__feed">
                @for (e of encounters(); track e.id) {
                  <li class="obd__ev">
                    <div class="obd__ev-main">
                      <span class="obd__ev-when">{{ when(e) }}</span>
                      <span class="obd__ev-what">
                        @if (e.counterplayId) {
                          {{ counterplayText(e.counterplayId) }}
                        } @else {
                          <span class="obd__muted">просто отметил</span>
                        }
                      </span>
                      @if (e.note) {
                        <span class="obd__ev-note">{{ e.note }}</span>
                      }
                    </div>
                    <div class="obd__ev-outcome">
                      @if (outcome(e); as label) {
                        <span class="obd__ev-badge">{{ label }}</span>
                      } @else if (e.counterplayId) {
                        <span class="obd__ask">
                          Помогло?
                          <button type="button" class="obd__ask-btn" (click)="rate(e, 'helped')">да</button>
                          <button type="button" class="obd__ask-btn" (click)="rate(e, 'partly')">частично</button>
                          <button type="button" class="obd__ask-btn" (click)="rate(e, 'no')">не очень</button>
                        </span>
                      }
                    </div>
                  </li>
                }
              </ul>
              @if (nextCursor() !== null) {
                <app-button variant="ghost" [loading]="feedBusy()" (click)="loadMore()">
                  Показать ещё
                </app-button>
              }
            }
          </app-card>
        }

        @if (actionError(); as ae) {
          <p class="obd__error">{{ ae }}</p>
        }
      }
    </section>
  `,
  styles: [
    `
      .obd {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .obd__back {
        color: var(--color-text-muted);
        text-decoration: none;
        font-size: var(--fs-sm);
      }
      .obd__back:hover {
        color: var(--color-text);
      }
      .obd__head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .obd__type-ico {
        font-size: var(--fs-xl, 1.5rem);
      }
      .obd__title {
        margin: 0;
      }
      .obd__sub {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .obd__dot {
        opacity: 0.5;
      }
      .obd__badge {
        padding: 0 var(--space-2);
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .obd__section {
        margin: 0 0 var(--space-3);
        font-size: var(--fs-md);
      }
      .obd__cps {
        list-style: none;
        margin: 0 0 var(--space-3);
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .obd__cp-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
      }
      .obd__cp-main {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }
      .obd__cp-meta {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .obd__cp-edit,
      .obd__add {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
      }
      .obd__cp-actions {
        display: flex;
        gap: var(--space-1);
        flex-shrink: 0;
      }
      .obd__input {
        flex: 1 1 12rem;
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
      }
      .obd__select {
        flex: 0 1 12rem;
      }
      .obd__grip {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        cursor: grab;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
      }
      .obd__grip:active {
        cursor: grabbing;
      }
      .obd__icon-btn {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm);
      }
      .obd__icon-btn:hover {
        background: var(--color-surface-3, var(--color-surface));
      }
      .obd__facts {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-1) var(--space-3);
        margin: 0;
        font-size: var(--fs-sm);
      }
      .obd__facts dt {
        color: var(--color-text-muted);
      }
      .obd__facts dd {
        margin: 0;
      }
      .obd__hint,
      .obd__starter-note {
        margin: var(--space-2) 0 0;
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .obd__feed {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .obd__ev {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-2);
        border-bottom: 1px solid var(--color-border);
      }
      .obd__ev-main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .obd__ev-when {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .obd__ev-note {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .obd__ev-badge {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
        white-space: nowrap;
      }
      .obd__ask {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
        flex-wrap: wrap;
      }
      .obd__ask-btn {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-muted);
        font: inherit;
        font-size: var(--fs-xs);
        padding: 2px var(--space-2);
        cursor: pointer;
      }
      .obd__ask-btn:hover {
        color: var(--color-text);
        border-color: var(--color-accent);
      }
      .obd__muted {
        color: var(--color-text-muted);
      }
      .obd__error {
        color: var(--color-danger);
      }
    `,
  ],
})
export class ObstacleDetailComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _dialog = inject(MatDialog);

  /** Идентификатор препятствия из маршрута. */
  private readonly _id = this._route.snapshot.paramMap.get('id') ?? '';

  /** Препятствие. */
  protected readonly item = signal<ObstacleView | null>(null);
  /** Контрмеры в ручном порядке. */
  protected readonly counterplays = signal<CounterplayView[]>([]);
  /** Микро-победы аккаунта (для привязки ответа к таймеру). */
  protected readonly microWins = signal<MicroWinView[]>([]);
  /** Идёт загрузка экрана. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки. */
  protected readonly error = signal<string | null>(null);
  /** Ошибка действия (добавление/правка/удаление) — экран остаётся рабочим. */
  protected readonly actionError = signal<string | null>(null);
  /** Идёт запись. */
  protected readonly busy = signal(false);
  /** Id редактируемой контрмеры или null. */
  protected readonly editingId = signal<string | null>(null);
  /** Лента столкновений (новые→старые). */
  protected readonly encounters = signal<ObstacleEncounterView[]>([]);
  /** Идёт запись столкновения. */
  protected readonly encounterBusy = signal(false);
  /** Курсор следующей страницы ленты или null (дальше пусто). */
  protected readonly nextCursor = signal<string | null>(null);
  /** Идёт подгрузка следующей страницы ленты. */
  protected readonly feedBusy = signal(false);

  /** Текст новой контрмеры. */
  protected newText = '';
  /** Привязка новой контрмеры к микро-победе (пустая строка = без таймера). */
  protected newLink = '';
  /** Текст редактируемой контрмеры. */
  protected editText = '';
  /** Привязка редактируемой контрмеры. */
  protected editLink = '';

  public constructor() {
    this._load();
  }

  /** Загружает препятствие, его ответы и каталог микро-побед. */
  private _load(): void {
    this.loading.set(true);
    this._api.getObstacle(this._id).subscribe({
      next: (obstacle) => {
        this.item.set(obstacle);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
    this._api.listCounterplays(this._id).subscribe({
      next: (list) => this.counterplays.set(list),
      error: (err: unknown) => this.actionError.set(errorMessage(err)),
    });
    this._api.listMicroWins().subscribe({
      next: (list) => this.microWins.set(list),
      error: () => this.microWins.set([]),
    });
    this._api.listEncounters(this._id).subscribe({
      next: (page) => {
        this.encounters.set(page.items);
        this.nextCursor.set(page.nextCursor);
      },
      error: () => this.encounters.set([]),
    });
  }

  /**
   * Перетаскивание ответов (ADR-0054). Порядок ручной и авто-сортировки по действенности нет:
   * список не должен прыгать под руками (ADR-0062 п.7).
   * @param event Событие CDK.
   */
  protected dropCounterplay(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.counterplays()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.counterplays.set(next);
    this._api.reorderCounterplays(this._id, next.map((c) => c.id)).subscribe({
      error: (err: unknown) => {
        this.actionError.set(errorMessage(err));
        this._api.listCounterplays(this._id).subscribe({
          next: (list) => this.counterplays.set(list),
          error: () => undefined,
        });
      },
    });
  }

  /** Подгружает следующую страницу ленты (keyset — «Показать ещё», не номера страниц). */
  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (cursor === null || this.feedBusy()) {
      return;
    }
    this.feedBusy.set(true);
    this._api.listEncounters(this._id, { cursor }).subscribe({
      next: (page) => {
        this.encounters.update((list) => [...list, ...page.items]);
        this.nextCursor.set(page.nextCursor);
        this.feedBusy.set(false);
      },
      error: (err: unknown) => {
        this.actionError.set(errorMessage(err));
        this.feedBusy.set(false);
      },
    });
  }

  /**
   * «Столкнулся» — главный поток: показываем свои ответы, выбор пишет столкновение. Если у
   * выбранного ответа есть привязанная микро-победа, сразу открываем её таймер: от «что делать»
   * до «делаю» один тап, без похода в другой раздел (ADR-0057).
   */
  protected openEncounter(): void {
    const obstacle = this.item();
    if (!obstacle || this.encounterBusy()) {
      return;
    }
    const data: EncounterModalData = {
      obstacleName: obstacle.name,
      counterplays: this.counterplays(),
    };
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
        this._record(result);
      });
  }

  /**
   * Пишет столкновение и обновляет экран точечно (карточка приходит в ответе со свежими
   * счётчиками — второй запрос не нужен).
   * @param result Что выбрал человек.
   */
  private _record(result: EncounterModalResult): void {
    this.encounterBusy.set(true);
    this.actionError.set(null);
    this._api
      .recordEncounter(this._id, { counterplayId: result.counterplayId, note: result.note })
      .subscribe({
        next: (recorded) => {
          this.item.set(recorded.obstacle);
          this.encounters.update((list) => [recorded.encounter, ...list]);
          this.encounterBusy.set(false);
          if (result.counterplayId !== null) {
            this._maybeStartTimer(result.counterplayId);
          }
        },
        error: (err: unknown) => {
          this.actionError.set(errorMessage(err));
          this.encounterBusy.set(false);
        },
      });
  }

  /**
   * Запускает таймер микро-победы, если выбранный ответ к ней привязан. Само столкновение уже
   * записано — таймер это помощь в действии, а не условие зачёта.
   * @param counterplayId Идентификатор выбранного ответа.
   */
  private _maybeStartTimer(counterplayId: string): void {
    const counterplay = this.counterplays().find((c) => c.id === counterplayId);
    const linkedId = counterplay?.linkedMicroWinId ?? null;
    if (linkedId === null) {
      return;
    }
    const microWin = this.microWins().find((mw) => mw.id === linkedId);
    if (!microWin) {
      return;
    }
    const ref = this._dialog.open<
      AccentTimerModalComponent,
      AccentTimerData,
      AccentTimerResult | null
    >(AccentTimerModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      disableClose: true,
      data: {
        title: microWin.title,
        durationSeconds: microWin.durationSeconds,
        prepSeconds: microWin.prepSeconds,
        mode: 'binary',
      },
    });
    ref.afterClosed().subscribe((timer) => {
      if (timer?.status === 'done') {
        // Доводим до конца и микро-победу: человек её реально сделал.
        this._api.completeMicroWin(microWin.id).subscribe({
          error: (err: unknown) => this.actionError.set(errorMessage(err)),
        });
      }
    });
  }

  /**
   * Проставляет исход столкновения («Помогло?»). Отвечать необязательно — но ответ уточняет
   * «помогало N из M» у контрмеры.
   * @param encounter Запись.
   * @param outcome Исход.
   */
  protected rate(encounter: ObstacleEncounterView, outcome: EncounterOutcome): void {
    this._api.setEncounterOutcome(this._id, encounter.id, outcome).subscribe({
      next: (updated) => {
        this.encounters.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
        // Действенность пересчитывается на сервере — перечитываем ответы.
        this._api.listCounterplays(this._id).subscribe({
          next: (list) => this.counterplays.set(list),
          error: () => undefined,
        });
      },
      error: (err: unknown) => this.actionError.set(errorMessage(err)),
    });
  }

  /**
   * Текст ответа, применённого в записи журнала.
   * @param counterplayId Идентификатор ответа.
   * @returns Текст или «ответ удалён» (ссылка обнулилась при удалении).
   */
  protected counterplayText(counterplayId: string): string {
    return this.counterplays().find((c) => c.id === counterplayId)?.text ?? 'ответ удалён';
  }

  /**
   * Человеческая дата записи.
   * @param encounter Запись.
   * @returns Подпись вида «сегодня, 21:40».
   */
  protected when(encounter: ObstacleEncounterView): string {
    return encounterWhen(encounter.occurredAt);
  }

  /**
   * Ярлык исхода.
   * @param encounter Запись.
   * @returns Подпись или null (не отмечено).
   */
  protected outcome(encounter: ObstacleEncounterView): string | null {
    return outcomeLabel(encounter.outcome);
  }

  /** Добавляет контрмеру; список обновляется точечно, без перезагрузки экрана. */
  protected addCounterplay(): void {
    const text = this.newText.trim();
    if (text === '' || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this._api
      .createCounterplay(this._id, {
        text,
        linkedMicroWinId: this.newLink === '' ? null : this.newLink,
      })
      .subscribe({
        next: (created) => {
          this.counterplays.update((list) => [...list, created]);
          this.item.update((o) =>
            o ? { ...o, counterplaysCount: o.counterplaysCount + 1 } : o,
          );
          this.newText = '';
          this.newLink = '';
          this.busy.set(false);
        },
        error: (err: unknown) => {
          this.actionError.set(errorMessage(err));
          this.busy.set(false);
        },
      });
  }

  /**
   * Включает inline-правку ответа.
   * @param counterplay Контрмера.
   */
  protected startEdit(counterplay: CounterplayView): void {
    this.editingId.set(counterplay.id);
    this.editText = counterplay.text;
    this.editLink = counterplay.linkedMicroWinId ?? '';
  }

  /** Выходит из режима правки без сохранения. */
  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  /**
   * Сохраняет правку ответа.
   * @param counterplay Контрмера.
   */
  protected saveEdit(counterplay: CounterplayView): void {
    const text = this.editText.trim();
    if (text === '' || this.busy()) {
      return;
    }
    this.busy.set(true);
    this._api
      .updateCounterplay(this._id, counterplay.id, {
        text,
        linkedMicroWinId: this.editLink === '' ? null : this.editLink,
      })
      .subscribe({
        next: (updated) => {
          this.counterplays.update((list) =>
            list.map((c) => (c.id === updated.id ? updated : c)),
          );
          this.editingId.set(null);
          this.busy.set(false);
        },
        error: (err: unknown) => {
          this.actionError.set(errorMessage(err));
          this.busy.set(false);
        },
      });
  }

  /**
   * Удаляет ответ. Записи журнала, где он применялся, остаются — теряется лишь «чем ответил».
   * @param counterplay Контрмера.
   */
  protected removeCounterplay(counterplay: CounterplayView): void {
    this._api.deleteCounterplay(this._id, counterplay.id).subscribe({
      next: () => {
        this.counterplays.update((list) => list.filter((c) => c.id !== counterplay.id));
        this.item.update((o) =>
          o ? { ...o, counterplaysCount: Math.max(0, o.counterplaysCount - 1) } : o,
        );
      },
      error: (err: unknown) => this.actionError.set(errorMessage(err)),
    });
  }

  /**
   * Название привязанной микро-победы.
   * @param id Идентификатор микро-победы.
   * @returns Название или «микро-победа» (если её удалили — привязка уже обнулена сервером).
   */
  protected microWinTitle(id: string): string {
    return this.microWins().find((mw) => mw.id === id)?.title ?? 'микро-победа';
  }

  /**
   * Подпись действенности ответа или null (оценок нет).
   * @param counterplay Контрмера.
   * @returns Подпись или null.
   */
  protected effectiveness(counterplay: CounterplayView): string | null {
    return effectivenessLabel(counterplay.helpedCount, counterplay.ratedCount);
  }

  /**
   * Иконка вида.
   * @param type Вид препятствия.
   * @returns Эмодзи.
   */
  protected typeIcon(type: ObstacleView['type']): string {
    return obstacleTypeIcon(type);
  }

  /**
   * Ярлык вида.
   * @param type Вид препятствия.
   * @returns Название.
   */
  protected typeLabel(type: ObstacleView['type']): string {
    return obstacleTypeLabel(type);
  }

  /**
   * Подпись частоты.
   * @param obstacle Препятствие.
   * @returns Подпись.
   */
  protected encountersText(obstacle: ObstacleView): string {
    return encountersLabel(obstacle.encountersLast30);
  }

  /**
   * Подпись числа ответов (берётся из локального счётчика — он обновляется при добавлении).
   * @returns Подпись.
   */
  protected counterplaysText(): string {
    return counterplaysLabel(this.counterplays().length);
  }

  /**
   * Шкала давления точками.
   * @param intensity Значение 1..5.
   * @returns Строка вида «●●●○○».
   */
  protected pressure(intensity: number): string {
    const filled = Math.max(0, Math.min(5, intensity));
    return '●'.repeat(filled) + '○'.repeat(5 - filled);
  }
}
