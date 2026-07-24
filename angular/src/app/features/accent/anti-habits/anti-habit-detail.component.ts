import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import {
  formatDurationCompact,
  pluralDays,
  streakDays,
  streakParts,
} from './anti-habit-format.util';
import { AntiHabitFormModalComponent } from './anti-habit-form-modal.component';
import type { AntiHabitFormData } from './anti-habit-form-modal.component';
import { AntiHabitRelapseModalComponent } from './anti-habit-relapse-modal.component';
import { AntiHabitRescheduleModalComponent } from './anti-habit-reschedule-modal.component';
import type {
  AntiHabitEventView,
  AntiHabitPayload,
  AntiHabitView,
  RelapsePayload,
} from '../accent.types';

/** Геометрия SVG-кольца прогресса. */
const RING_SIZE = 132;
const RING_RADIUS = 58;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

/**
 * Деталь «держусь» (`/accent/anti-habits/:id`): большое **живое** кольцо серии (тикает раз в
 * секунду), дн/чч:мм:сс, рекорд (переживает срыв), кнопка «Сорвался → новая попытка» и история
 * попыток (cursor-пагинация). Тон non-punitive (ADR-0049). Тонкий слой над `AccentApiService`.
 */
@Component({
  selector: 'app-anti-habit-detail',
  imports: [RouterLink, ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ahd">
      <a class="ahd__back" routerLink="..">← К списку</a>

      @if (loading()) {
        <p class="ahd__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="ahd__error">{{ error() }}</p>
      } @else if (item(); as ah) {
        <header class="ahd__head">
          <h2 class="ahd__title">{{ ah.title }}</h2>
          <span class="tooltip-host" [attr.data-tooltip]="'Изменить'">
            <app-button variant="ghost" ariaLabel="Изменить" (click)="openEdit(ah)">✏️</app-button>
          </span>
        </header>

        @if (ah.description) {
          <p class="ahd__desc">{{ ah.description }}</p>
        }

        <div class="ahd__ring-wrap">
          <svg
            class="ahd__ring"
            [attr.width]="ringSize"
            [attr.height]="ringSize"
            [attr.viewBox]="'0 0 ' + ringSize + ' ' + ringSize"
            aria-hidden="true"
          >
            <circle
              class="ahd__ring-track"
              [attr.cx]="ringSize / 2"
              [attr.cy]="ringSize / 2"
              [attr.r]="ringRadius"
              fill="none"
            />
            @if (ah.targetDays !== null) {
              <circle
                class="ahd__ring-arc"
                [attr.cx]="ringSize / 2"
                [attr.cy]="ringSize / 2"
                [attr.r]="ringRadius"
                fill="none"
                [attr.stroke-dasharray]="ringCirc"
                [attr.stroke-dashoffset]="ringOffset()"
                [attr.transform]="'rotate(-90 ' + ringSize / 2 + ' ' + ringSize / 2 + ')'"
              />
            }
          </svg>
          <div class="ahd__ring-center">
            <span class="ahd__days">{{ parts().days }}</span>
            <span class="ahd__days-label">{{ dayWord(parts().days) }}</span>
          </div>
        </div>

        @if (ah.state === 'planned') {
          <p class="ahd__planned">🗓 Старт запланирован: {{ dateLabel(ah.currentAttemptStartedAt) }} · через {{ untilStart(ah) }}</p>
        } @else {
          <p class="ahd__clock">{{ clock() }}</p>
        }
        <p class="ahd__meta">
          @if (ah.targetDays !== null) {
            <span>🎯 цель: {{ ah.targetDays }} {{ dayWord(ah.targetDays) }}</span>
          }
          <span class="ahd__stat">🏆 рекорд: <strong class="ahd__num">{{ ah.recordDays }}</strong> {{ dayWord(ah.recordDays) }}</span>
          <span class="ahd__stat">попытка <strong class="ahd__num">№{{ ah.attemptNumber }}</strong></span>
        </p>

        <div class="ahd__actions">
          <app-button variant="ghost" [loading]="relapseBusy()" (click)="openRelapse(ah)">
            <span aria-hidden="true">🔄</span>
            Рецидив
          </app-button>
          <app-button variant="ghost" (click)="openReschedule(ah)">
            <span aria-hidden="true">🗓</span>
            Перенести в будущее
          </app-button>
        </div>

        <section class="ahd__history">
          <h3 class="ahd__h3">История</h3>
          @if (events().length === 0) {
            <p class="ahd__muted">Событий пока нет — так держать 💪</p>
          } @else {
            <ul class="ahd__hist-list">
              @for (e of events(); track e.id) {
                <li>
                  <app-card>
                    <div class="ahd__hist">
                      <span class="ahd__hist-dur">{{ eventTitle(e) }}</span>
                      <span class="ahd__hist-date">{{ dateLabel(e.occurredAt) }}</span>
                      @if (e.triggerTag) {
                        <span class="ahd__hist-tag">триггер: {{ e.triggerTag }}</span>
                      }
                      @if (e.note) {
                        <span class="ahd__hist-note">{{ e.note }}</span>
                      }
                    </div>
                  </app-card>
                </li>
              }
            </ul>
            @if (!historyEnd()) {
              <div class="ahd__more">
                <app-button variant="ghost" [loading]="historyLoading()" (click)="loadMoreHistory()">
                  Показать ещё
                </app-button>
              </div>
            }
          }
        </section>
      }
    </section>
  `,
  styles: [
    `
      .ahd {
        padding: var(--space-4) 0;
        display: flex;
        flex-direction: column;
      }
      .ahd__back {
        color: var(--color-text-muted);
        text-decoration: none;
        font-size: var(--fs-sm);
        margin-bottom: var(--space-3);
      }
      .ahd__back:hover {
        color: var(--color-text);
      }
      .ahd__muted {
        color: var(--color-text-muted);
      }
      .ahd__error {
        color: var(--color-danger);
      }
      .ahd__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .ahd__title {
        margin: 0;
      }
      .ahd__desc {
        margin: var(--space-2) 0 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .ahd__ring-wrap {
        position: relative;
        align-self: center;
        width: ${RING_SIZE}px;
        height: ${RING_SIZE}px;
        margin: var(--space-5) 0 var(--space-3);
      }
      .ahd__ring-track {
        stroke: var(--color-border);
        stroke-width: 10;
      }
      .ahd__ring-arc {
        stroke: var(--color-accent);
        stroke-width: 10;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.5s ease;
      }
      .ahd__ring-center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }
      .ahd__days {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        color: var(--color-accent);
        font-variant-numeric: tabular-nums;
      }
      .ahd__days-label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ahd__clock {
        align-self: center;
        margin: 0;
        font-size: var(--fs-lg);
        font-variant-numeric: tabular-nums;
        color: var(--color-text);
      }
      .ahd__planned {
        align-self: center;
        margin: 0;
        font-size: var(--fs-md);
        color: var(--color-accent);
        text-align: center;
      }
      .ahd__meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-1) var(--space-4);
        margin: var(--space-2) 0 var(--space-4);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ahd__stat {
        color: var(--color-text);
        font-weight: 600;
      }
      .ahd__num {
        color: var(--color-accent);
        font-weight: 700;
      }
      .ahd__actions {
        display: flex;
        justify-content: center;
        margin-bottom: var(--space-5);
      }
      .ahd__history {
        border-top: 1px solid var(--color-border);
        padding-top: var(--space-4);
      }
      .ahd__h3 {
        margin: 0 0 var(--space-3);
        font-size: var(--fs-md);
      }
      .ahd__hist-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .ahd__hist {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ahd__hist-dur {
        font-weight: 600;
      }
      .ahd__hist-date {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ahd__hist-tag {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ahd__hist-note {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        font-style: italic;
      }
      .ahd__more {
        display: flex;
        justify-content: center;
        margin-top: var(--space-3);
      }
    `,
  ],
})
export class AntiHabitDetailComponent implements OnDestroy {
  private readonly _route = inject(ActivatedRoute);
  private readonly _api = inject(AccentApiService);
  private readonly _dialog = inject(MatDialog);
  private readonly _modal = inject(ModalService);

  /** Геометрия кольца (для шаблона). */
  protected readonly ringSize = RING_SIZE;
  protected readonly ringRadius = RING_RADIUS;
  protected readonly ringCirc = RING_CIRC;

  /** Id из маршрута. */
  private readonly _id = this._route.snapshot.paramMap.get('id') ?? '';

  /** Анти-привычка или null (пока грузится). */
  protected readonly item = signal<AntiHabitView | null>(null);
  /** Первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка или null. */
  protected readonly error = signal<string | null>(null);
  /** Идёт фиксация срыва. */
  protected readonly relapseBusy = signal(false);
  /** История событий (новые→старые). */
  protected readonly events = signal<AntiHabitEventView[]>([]);
  /** Курсор следующей страницы истории или null. */
  private readonly _historyCursor = signal<string | null>(null);
  /** Больше страниц истории нет. */
  protected readonly historyEnd = signal(false);
  /** Идёт подгрузка истории. */
  protected readonly historyLoading = signal(false);
  /** Тикающий «сейчас» (unix ms). */
  private readonly _now = signal(Date.now());
  /** Хендл тика (очистка в ngOnDestroy). */
  private _timer: number | undefined;

  /** Компоненты серии (живые). */
  protected readonly parts = computed(() => {
    const ah = this.item();
    return ah === null
      ? { days: 0, hours: 0, minutes: 0, seconds: 0 }
      : streakParts(ah.currentAttemptStartedAt, this._now());
  });

  /** Живая строка чч:мм:сс. */
  protected readonly clock = computed(() => {
    const p = this.parts();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  });

  /** Смещение дуги кольца по прогрессу серии к цели (0 полн. — full). */
  protected readonly ringOffset = computed(() => {
    const ah = this.item();
    if (ah === null || ah.targetDays === null || ah.targetDays <= 0) {
      return RING_CIRC;
    }
    const days = streakDays(ah.currentAttemptStartedAt, this._now());
    const frac = Math.min(1, Math.max(0, days / ah.targetDays));
    return RING_CIRC * (1 - frac);
  });

  public constructor() {
    this._load();
    this.loadMoreHistory();
    this._timer = window.setInterval(() => this._now.set(Date.now()), 1000);
  }

  /** Останавливает тик. */
  public ngOnDestroy(): void {
    if (this._timer !== undefined) {
      window.clearInterval(this._timer);
    }
  }

  /** RU-склонение «день». */
  protected dayWord(n: number): string {
    return pluralDays(n);
  }

  /** Компактная длительность попытки (для истории). */
  protected durationLabel(ms: number): string {
    return formatDurationCompact(ms);
  }

  /** Дата человекочитаемо. */
  protected dateLabel(ms: number): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  }

  /** Заголовок события истории по типу. */
  protected eventTitle(e: AntiHabitEventView): string {
    switch (e.type) {
      case 'relapse':
        return `🔄 Рецидив · продержался ${formatDurationCompact(e.attemptDurationMs ?? 0)}`;
      case 'reschedule':
        return `🗓 Перенос старта · продержался ${formatDurationCompact(e.attemptDurationMs ?? 0)}`;
      case 'plan':
        return `🗓 Запланирован старт${e.toStartedAt !== null ? ': ' + this.dateLabel(e.toStartedAt) : ''}`;
      case 'goal_reached':
        return `🏆 Цель достигнута${e.thresholdLabel !== null ? ': ' + e.thresholdLabel : ''}`;
      default:
        return 'Событие';
    }
  }

  /** Сколько осталось до планового старта (для `planned`). */
  protected untilStart(ah: AntiHabitView): string {
    const days = Math.max(0, Math.ceil((ah.currentAttemptStartedAt - this._now()) / 86_400_000));
    return `${days} ${pluralDays(days)}`;
  }

  private _load(): void {
    this.loading.set(true);
    this._api.getAntiHabit(this._id).subscribe({
      next: (ah) => {
        this.item.set(ah);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Подгружает следующую страницу истории срывов (cursor-пагинация). */
  protected loadMoreHistory(): void {
    if (this.historyLoading() || this.historyEnd()) {
      return;
    }
    this.historyLoading.set(true);
    this._api.listAntiHabitEvents(this._id, this._historyCursor() ?? undefined).subscribe({
      next: (page) => {
        this.events.update((list) => [...list, ...page.items]);
        this._historyCursor.set(page.nextCursor);
        if (page.nextCursor === null) {
          this.historyEnd.set(true);
        }
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  /** Открывает модалку срыва → при подтверждении фиксирует и обновляет счётчик+историю. */
  protected openRelapse(ah: AntiHabitView): void {
    const ref = this._dialog.open<AntiHabitRelapseModalComponent, undefined, RelapsePayload | null>(
      AntiHabitRelapseModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush' },
    );
    ref.afterClosed().subscribe((payload) => {
      if (!payload) {
        return;
      }
      this.relapseBusy.set(true);
      this._api.relapseAntiHabit(ah.id, payload).subscribe({
        next: (res) => {
          this.item.set(res.antiHabit);
          this.events.update((list) => [res.event, ...list]);
          this.relapseBusy.set(false);
        },
        error: (err: unknown) => {
          this.relapseBusy.set(false);
          this._modal.error('Не удалось отметить срыв', errorMessage(err));
        },
      });
    });
  }

  /** Открывает модалку переноса → при выборе даты переносит старт в будущее (planned). */
  protected openReschedule(ah: AntiHabitView): void {
    const ref = this._dialog.open<AntiHabitRescheduleModalComponent, undefined, number | null>(
      AntiHabitRescheduleModalComponent,
      { width: MODAL_SMALL_WIDTH, panelClass: 'modal-flush' },
    );
    ref.afterClosed().subscribe((startAt) => {
      if (startAt === null || startAt === undefined) {
        return;
      }
      this._api.rescheduleAntiHabit(ah.id, { startAt }).subscribe({
        next: (res) => {
          this.item.set(res.antiHabit);
          this.events.update((list) => [res.event, ...list]);
        },
        error: (err: unknown) => this._modal.error('Не удалось перенести', errorMessage(err)),
      });
    });
  }

  /** Открывает форму редактирования → обновляет карточку при успехе. */
  protected openEdit(ah: AntiHabitView): void {
    const ref = this._dialog.open<
      AntiHabitFormModalComponent,
      AntiHabitFormData,
      AntiHabitPayload | null
    >(AntiHabitFormModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      data: { antiHabit: ah, submit: (payload) => this._api.updateAntiHabit(ah.id, payload) },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this._load();
      }
    });
  }
}
