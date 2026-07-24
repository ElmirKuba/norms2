import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
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
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { formatStreakLong, pluralDays, streakParts } from './anti-habit-format.util';
import { AntiHabitFormModalComponent } from './anti-habit-form-modal.component';
import type { AntiHabitFormData } from './anti-habit-form-modal.component';
import type { AntiHabitPayload, AntiHabitView } from '../accent.types';

/**
 * Экран «Держусь» (`/accent/anti-habits`): трекер воздержания «не делаю X». Карточка = живой
 * счётчик серии (тикает раз в секунду из `currentAttemptStartedAt`) + рекорд, который
 * переживает срыв. Клик по карточке → деталь (большое кольцо + «Сорвался» + история).
 * Тон non-punitive (ADR-0049, [[accent-sustainable-achievement-design]]): срыв — не провал,
 * а новая попытка; рекорд всегда на виду. Тонкий слой над `AccentApiService`.
 */
@Component({
  selector: 'app-anti-habits',
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
    <section class="ah">
      <header class="ah__head">
        <h2>Держусь</h2>
        <span class="tooltip-host" [attr.data-tooltip]="'Добавить «держусь»'">
          <app-button ariaLabel="Добавить «держусь»" (click)="openCreate()">+</app-button>
        </span>
      </header>

      <aside class="ah__why">
        <span class="ah__why-icon" aria-hidden="true">🛡️</span>
        <p class="ah__why-text">
          <strong>От чего держишься.</strong> Здесь считается не «сколько сделал», а «сколько
          держусь без срыва». Сорвался — это новая попытка, а не провал: рекорд остаётся с тобой.
        </p>
      </aside>

      @if (loading()) {
        <p class="ah__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="ah__error">{{ error() }}</p>
      } @else if (items().length === 0) {
        <app-empty-state
          title="Пока нет ни одного «держусь»"
          text="Добавь то, от чего хочешь воздержаться — и запусти счётчик серии. Даже один день на счётчике — уже победа."
        >
          <app-button (click)="openCreate()">
            <span aria-hidden="true">➕</span>
            Добавить «держусь»
          </app-button>
        </app-empty-state>
      } @else {
        <ul class="ah__list" cdkDropList (cdkDropListDropped)="dropAntiHabit($event)">
          @for (ah of items(); track ah.id) {
            <li cdkDrag>
              <app-card>
                <div class="ah__item">
                  <button type="button" class="ah__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                  <a class="ah__link" [routerLink]="[ah.id]">
                    <strong class="ah__name">{{ ah.title }}</strong>
                    <span class="ah__streak">⏱ {{ streakLabel(ah) }}</span>
                    <span class="ah__sub">
                      <span class="ah__stat">🏆 рекорд: <strong class="ah__num">{{ ah.recordDays }}</strong> {{ dayWord(ah.recordDays) }}</span>
                      @if (ah.targetDays !== null) {
                        <span class="ah__target">🎯 цель: {{ ah.targetDays }} {{ dayWord(ah.targetDays) }}</span>
                      }
                      <span class="ah__stat">попытка <strong class="ah__num">№{{ ah.attemptNumber }}</strong></span>
                    </span>
                  </a>
                  <div class="ah__menu-wrap">
                    <span class="tooltip-host" [attr.data-tooltip]="'Дополнительные опции'">
                      <button
                        type="button"
                        class="ah__menu-btn"
                        aria-label="Дополнительные опции"
                        (click)="toggleMenu(ah.id, $event)"
                      >⋯</button>
                    </span>
                    @if (openMenuId() === ah.id) {
                      <div class="ah__menu" (click)="$event.stopPropagation()">
                        <button type="button" class="ah__menu-item" (click)="openEdit(ah); closeMenu()">
                          <span class="ah__menu-ico" aria-hidden="true">✏️</span>
                          Изменить
                        </button>
                        <button
                          type="button"
                          class="ah__menu-item ah__menu-item--danger"
                          (click)="removeFromList(ah); closeMenu()"
                        >
                          <span class="ah__menu-ico" aria-hidden="true">📦</span>
                          Убрать из списка
                        </button>
                      </div>
                    }
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
      .ah {
        padding: var(--space-4) 0;
      }
      .ah__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .ah__why {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        margin: var(--space-3) 0 var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-2);
        border-left: 3px solid var(--color-accent);
        border-radius: var(--radius-md);
      }
      .ah__why-icon {
        font-size: var(--fs-lg);
        line-height: 1.3;
      }
      .ah__why-text {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ah__why-text strong {
        color: var(--color-text);
      }
      .ah__muted {
        color: var(--color-text-muted);
      }
      .ah__error {
        color: var(--color-danger);
      }
      .ah__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .ah__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .ah__grip {
        border: none;
        background: transparent;
        cursor: grab;
        color: var(--color-text-muted);
        font-size: var(--fs-md);
        line-height: 1;
        padding: 0 var(--space-1);
        touch-action: none;
        flex-shrink: 0;
      }
      .ah__grip:active {
        cursor: grabbing;
      }
      .cdk-drag-preview {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      }
      .cdk-drag-placeholder {
        opacity: 0.4;
      }
      .ah__link {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
        flex: 1;
        text-decoration: none;
        color: inherit;
      }
      .ah__link:hover .ah__name {
        color: var(--color-accent);
      }
      .ah__name {
        font-size: var(--fs-md);
      }
      .ah__streak {
        font-size: var(--fs-md);
        font-variant-numeric: tabular-nums;
        color: var(--color-accent);
        font-weight: 600;
      }
      .ah__sub {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-3);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ah__stat {
        color: var(--color-text);
        font-weight: 600;
      }
      .ah__num {
        color: var(--color-accent);
        font-weight: 700;
      }
      .ah__menu-wrap {
        position: relative;
        display: inline-flex;
        flex-shrink: 0;
      }
      .ah__menu-btn {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-lg);
        line-height: 1;
      }
      .ah__menu-btn:hover {
        color: var(--color-text);
        border-color: var(--color-text-muted);
      }
      .ah__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        min-width: 180px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-1);
        overflow: hidden;
      }
      .ah__menu-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        text-align: left;
        padding: var(--space-2) var(--space-3);
        min-height: var(--touch-min);
        background: none;
        border: none;
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .ah__menu-item:hover {
        background: var(--color-surface-2);
      }
      .ah__menu-item--danger {
        color: var(--color-danger);
      }
      .ah__menu-ico {
        width: 1.2em;
        text-align: center;
        flex-shrink: 0;
      }
    `,
  ],
})
export class AntiHabitsComponent implements OnDestroy {
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);
  private readonly _modal = inject(ModalService);

  /** Список анти-привычек. */
  protected readonly items = signal<AntiHabitView[]>([]);
  /** Идёт первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки или null. */
  protected readonly error = signal<string | null>(null);
  /** Id карточки с открытым меню «⋯» или null. */
  protected readonly openMenuId = signal<string | null>(null);
  /** Тикающий «сейчас» (unix ms) — двигает живые счётчики серий. */
  private readonly _now = signal(Date.now());
  /** Хендл интервала тика (очистка в ngOnDestroy). */
  private _timer: number | undefined;

  public constructor() {
    this._load();
    this._timer = window.setInterval(() => this._now.set(Date.now()), 1000);
  }

  /** Останавливает тик серий. */
  public ngOnDestroy(): void {
    if (this._timer !== undefined) {
      window.clearInterval(this._timer);
    }
  }

  /** Живая подпись серии карточки (дн чч:мм:сс). */
  protected streakLabel(ah: AntiHabitView): string {
    return formatStreakLong(streakParts(ah.currentAttemptStartedAt, this._now()));
  }

  /** RU-склонение «день». */
  protected dayWord(n: number): string {
    return pluralDays(n);
  }

  /** Переключает меню «⋯». */
  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((cur) => (cur === id ? null : id));
  }

  /** Закрывает меню «⋯». */
  protected closeMenu(): void {
    this.openMenuId.set(null);
  }

  /** Клик вне меню — закрыть. */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
    }
  }

  /** Escape — закрыть меню. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.openMenuId.set(null);
  }

  /** Drag-reorder (ADR-0054): оптимистично + `reorderAntiHabits`; откат при ошибке. */
  protected dropAntiHabit(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.items()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.set(next);
    this._api.reorderAntiHabits(next.map((ah) => ah.id)).subscribe({
      error: (err: unknown) => {
        this._load();
        this._modal.error('Не удалось сохранить порядок', errorMessage(err));
      },
    });
  }

  private _load(): void {
    this.loading.set(true);
    this._api.listAntiHabits().subscribe({
      next: (items) => {
        this.items.set(items);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Открывает модалку создания. */
  protected openCreate(): void {
    this._openForm({}, (payload) => this._api.createAntiHabit(payload));
  }

  /** Открывает модалку редактирования. */
  protected openEdit(ah: AntiHabitView): void {
    this._openForm({ antiHabit: ah }, (payload) => this._api.updateAntiHabit(ah.id, payload));
  }

  /** Убирает из списка (мягко, `isActive:false`) после подтверждения; история сохраняется. */
  protected removeFromList(ah: AntiHabitView): void {
    void this._modal
      .confirm({
        title: 'Убрать из списка?',
        text: `«${ah.title}» скроется из списка. История попыток сохранится.`,
        confirmText: 'Убрать',
        danger: true,
      })
      .then((ok) => {
        if (ok) {
          this._api.updateAntiHabit(ah.id, { isActive: false }).subscribe({
            next: () => this._load(),
            error: (err: unknown) => this._modal.error('Не удалось убрать', errorMessage(err)),
          });
        }
      });
  }

  /**
   * Открывает форму создания/редактирования и перезагружает список при успехе.
   * @param data Данные модалки (анти-привычка для правки или пусто).
   * @param submit Функция сохранения по payload.
   */
  private _openForm(
    data: AntiHabitFormData,
    submit: (payload: AntiHabitPayload) => ReturnType<AccentApiService['createAntiHabit']>,
  ): void {
    const ref = this._dialog.open<
      AntiHabitFormModalComponent,
      AntiHabitFormData,
      AntiHabitPayload | null
    >(AntiHabitFormModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      data: { ...data, submit },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this._load();
      }
    });
  }
}
