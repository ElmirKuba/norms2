import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { MICRO_WIN_CATEGORY_LABELS } from '../accent.types';
import { CategoryGuideModalComponent } from './category-guide-modal.component';
import type { MicroWinPayload, MicroWinView } from '../accent.types';
import { MicroWinFormModalComponent } from './micro-win-form-modal.component';
import type { MicroWinFormData } from './micro-win-form-modal.component';

/**
 * Экран микро-побед (`/accent/micro-wins`): список «сделать сейчас» с дневным фидбэком
 * (`completedToday`), complete в один тап, CRUD через модалку. Стартовый пак — по кнопке
 * (2.3): пусто → CTA «Получить пак»; примеры помечены badge и присваиваются первым
 * «Сделал»/«Изм.»; контекстная кнопка «Очистить примеры» ↔ «Получить пак». Тонкий слой
 * над `AccentApiService`; философия — «тренажёр отказа» (ADR-0049): одно действие, без шума.
 */
@Component({
  selector: 'app-micro-wins',
  imports: [ButtonComponent, CardComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mw">
      <header class="mw__head">
        <h2>Микро-победы</h2>
        <div class="mw__head-actions">
          @if (items().length > 0) {
            @if (hasStarters()) {
              <app-button variant="ghost" [loading]="packBusy()" (click)="clearExamples()">
                Очистить примеры
              </app-button>
            } @else {
              <app-button variant="ghost" [loading]="packBusy()" (click)="seedPack()">
                Получить стартовый пак
              </app-button>
            }
          }
          <app-button (click)="openCreate()">Добавить</app-button>
        </div>
      </header>
      <aside class="mw__why">
        <span class="mw__why-icon" aria-hidden="true">🌱</span>
        <p class="mw__why-text">
          <strong>Раздел для тяжёлых дней.</strong> Нет сил на большое — сделай одно крошечное.
          Смысл не в том, чтобы успеть больше, а чтобы не упасть в ноль.
        </p>
      </aside>

      <button type="button" class="mw__cats-link" (click)="openCategoryGuide()">
        Что значат категории?
      </button>

      @if (loading()) {
        <p class="mw__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="mw__error">{{ error() }}</p>
      } @else if (items().length === 0) {
        <app-empty-state
          title="Пока нет микро-побед"
          text="Начни с готового набора маленьких действий — по силам даже в плохой день."
        >
          <app-button [loading]="packBusy()" (click)="seedPack()">Получить стартовый пак</app-button>
        </app-empty-state>
      } @else {
        @if (hasStarters()) {
          <p class="mw__hint">«Сделал» или «Изм.» оставит победу себе.</p>
        }
        <ul class="mw__list">
          @for (mw of items(); track mw.id) {
            <li>
              <app-card>
                <div class="mw__item">
                  <div class="mw__main">
                    <span class="mw__title-row">
                      <strong class="mw__name">{{ mw.title }}</strong>
                      @if (mw.isStarter) {
                        <span class="mw__badge">пример</span>
                      }
                    </span>
                    <span class="mw__meta">
                      {{ categoryLabel(mw.category) }} · {{ durationLabel(mw.durationSeconds) }} ·
                      энергия {{ mw.energyCost }}/3
                    </span>
                    @if (mw.effect) {
                      <span class="mw__effect">{{ mw.effect }}</span>
                    }
                  </div>
                  <div class="mw__actions">
                    @if (mw.completedToday) {
                      <span class="mw__done">✓ Сегодня</span>
                    } @else {
                      <span class="tooltip-host" [attr.data-tooltip]="'Я сегодня это сделал'">
                        <app-button
                          ariaLabel="Я сегодня это сделал"
                          [loading]="busyId() === mw.id"
                          (click)="complete(mw)"
                        >✓</app-button>
                      </span>
                    }
                    <div class="mw__menu-wrap">
                      <span class="tooltip-host" [attr.data-tooltip]="'Дополнительные опции'">
                        <button
                          type="button"
                          class="mw__menu-btn"
                          aria-label="Дополнительные опции"
                          (click)="toggleMenu(mw.id, $event)"
                        >⋯</button>
                      </span>
                      @if (openMenuId() === mw.id) {
                        <div class="mw__menu" (click)="$event.stopPropagation()">
                          <button type="button" class="mw__menu-item" (click)="openEdit(mw); closeMenu()">
                            <span class="mw__menu-ico" aria-hidden="true">✏️</span>
                            Изменить
                          </button>
                          <button
                            type="button"
                            class="mw__menu-item mw__menu-item--danger"
                            (click)="remove(mw); closeMenu()"
                          >
                            <span class="mw__menu-ico" aria-hidden="true">🗑️</span>
                            Удалить
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
      .mw {
        padding: var(--space-5);
      }
      .mw__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .mw__head-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .mw__why {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        margin: var(--space-3) 0 var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-2);
        border-left: 3px solid var(--color-accent);
        border-radius: var(--radius-md);
      }
      .mw__why-icon {
        font-size: var(--fs-lg);
        line-height: 1.3;
      }
      .mw__why-text {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .mw__why-text strong {
        color: var(--color-text);
      }
      .mw__cats-link {
        display: inline-block;
        margin: 0 0 var(--space-4);
        padding: 0;
        background: none;
        border: none;
        cursor: pointer;
        font-size: var(--fs-sm);
        color: var(--color-accent);
        text-decoration: underline;
      }
      .mw__hint {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        margin: 0 0 var(--space-3);
      }
      .mw__muted {
        color: var(--color-text-muted);
      }
      .mw__error {
        color: var(--color-danger);
      }
      .mw__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .mw__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .mw__main {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }
      .mw__title-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .mw__name {
        font-size: var(--fs-md);
      }
      .mw__badge {
        font-size: var(--fs-xs);
        color: var(--color-accent);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-1);
        opacity: 0.85;
      }
      .mw__meta {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .mw__effect {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        font-style: italic;
      }
      .mw__actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .mw__done {
        color: var(--color-accent);
        font-weight: 600;
        padding: 0 var(--space-2);
      }
      .mw__menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .mw__menu-btn {
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
      .mw__menu-btn:hover {
        color: var(--color-text);
        border-color: var(--color-text-muted);
      }
      .mw__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        min-width: 160px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-1);
        overflow: hidden;
      }
      .mw__menu-item {
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
      .mw__menu-item:hover {
        background: var(--color-surface-2);
      }
      .mw__menu-item--danger {
        color: var(--color-danger);
      }
      .mw__menu-ico {
        width: 1.2em;
        text-align: center;
        flex-shrink: 0;
      }
    `,
  ],
})
export class MicroWinsComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);
  private readonly _modal = inject(ModalService);

  /** Список микро-побед. */
  protected readonly items = signal<MicroWinView[]>([]);
  /** Идёт первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки (или null). */
  protected readonly error = signal<string | null>(null);
  /** Id микро-победы, по которой идёт отметка «сделал» (для спиннера). */
  protected readonly busyId = signal<string | null>(null);
  /** Идёт получение/очистка стартового пака. */
  protected readonly packBusy = signal(false);
  /** Id карточки с открытым меню «⋯» (обслуживание: Изменить/Удалить) или null. */
  protected readonly openMenuId = signal<string | null>(null);

  /** Переключает меню «⋯» карточки; stopPropagation — чтобы document-клик не закрыл сразу. */
  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((cur) => (cur === id ? null : id));
  }

  /** Закрывает меню «⋯». */
  protected closeMenu(): void {
    this.openMenuId.set(null);
  }

  /** Клик где угодно вне меню — закрыть (toggle/меню гасят всплытие). */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
    }
  }

  /** Escape — закрыть открытое меню. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.openMenuId.set(null);
  }

  /** Есть ли ещё не присвоенные стартовые (для badge-хинта и контекстной кнопки). */
  protected readonly hasStarters = computed(() => this.items().some((item) => item.isStarter));

  public constructor() {
    this._load();
  }

  /** RU-подпись категории. */
  protected categoryLabel(category: MicroWinView['category']): string {
    return MICRO_WIN_CATEGORY_LABELS[category];
  }

  /** Открывает модалку-гид по категориям. */
  protected openCategoryGuide(): void {
    this._dialog.open(CategoryGuideModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
    });
  }

  /** Человекочитаемая длительность. */
  protected durationLabel(seconds: number): string {
    return seconds < 60 ? `${String(seconds)} сек` : `${String(Math.round(seconds / 60))} мин`;
  }

  private _load(): void {
    this.loading.set(true);
    this._api.listMicroWins().subscribe({
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

  /** Получить стартовый пак (докидывает примеры) — список приходит свежим. */
  protected seedPack(): void {
    this.packBusy.set(true);
    this._api.seedStarterPack().subscribe({
      next: (items) => {
        this.items.set(items);
        this.packBusy.set(false);
      },
      error: () => this.packBusy.set(false),
    });
  }

  /** Очистить примеры (только не присвоенные стартовые) — список приходит свежим. */
  protected clearExamples(): void {
    this.packBusy.set(true);
    this._api.clearStarters().subscribe({
      next: (items) => {
        this.items.set(items);
        this.packBusy.set(false);
      },
      error: () => this.packBusy.set(false),
    });
  }

  /** Открывает модалку создания. */
  protected openCreate(): void {
    this._openForm({}, (payload) => this._api.createMicroWin(payload));
  }

  /** Открывает модалку редактирования. */
  protected openEdit(mw: MicroWinView): void {
    this._openForm({ microWin: mw }, (payload) => this._api.updateMicroWin(mw.id, payload));
  }

  /** Отмечает выполнение (один тап); патчит карточку (`completedToday`, adoption `isStarter`). */
  protected complete(mw: MicroWinView): void {
    if (mw.completedToday) {
      return;
    }
    this.busyId.set(mw.id);
    this._api.completeMicroWin(mw.id).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((it) => (it.id === updated.id ? updated : it)));
        this.busyId.set(null);
      },
      error: () => this.busyId.set(null),
    });
  }

  /** Удаляет после подтверждения. */
  protected remove(mw: MicroWinView): void {
    void this._modal
      .confirm({
        title: 'Удалить микро-победу?',
        text: `«${mw.title}» и её история выполнения будут удалены.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .then((ok) => {
        if (ok) {
          this._api.deleteMicroWin(mw.id).subscribe({ next: () => this._load(), error: () => undefined });
        }
      });
  }

  /**
   * Открывает форму и применяет результат через переданный API-вызов.
   * @param data Данные модалки (микро-победа для редактирования или пусто).
   * @param submit Функция сохранения по payload.
   */
  private _openForm(
    data: MicroWinFormData,
    submit: (payload: MicroWinPayload) => ReturnType<AccentApiService['createMicroWin']>,
  ): void {
    const ref = this._dialog.open<MicroWinFormModalComponent, MicroWinFormData, MicroWinPayload | null>(
      MicroWinFormModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush', data },
    );
    ref.afterClosed().subscribe((payload) => {
      if (payload) {
        submit(payload).subscribe({ next: () => this._load(), error: () => undefined });
      }
    });
  }
}
