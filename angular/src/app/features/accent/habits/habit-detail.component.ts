import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { HABIT_KIND_LABELS } from '../accent.types';
import type { HabitHistoryDay, HabitView } from '../accent.types';
import { recurrenceLabel } from './recurrence-label.util';

/**
 * Деталь привычки (`/accent/habits/:id`, 2.7.3) — **«что было с этой привычкой»**.
 *
 * Дневник пути с диагностическим уклоном, не витрина достижений и не отчёт. **Герой экрана —
 * рост планки**: это единственное место в продукте, где видно, что человек стал сильнее.
 *
 * **Тон — главное ограничение.** Дырки в сетке дней не рисуем вообще: лента показывает только то,
 * что было, а отсутствие остаётся отсутствием, а не событием «ты провалился». Поэтому и
 * формулировка «последняя отметка N дней назад», а не «пропущено N дней» — первое сообщает факт,
 * второе ставит оценку.
 */
@Component({
  selector: 'app-habit-detail',
  imports: [ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hd">
      <button type="button" class="hd__back" (click)="back()">← К привычкам</button>

      @if (loading()) {
        <p class="hd__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="hd__error">{{ error() }}</p>
      } @else if (habit(); as h) {
        <header class="hd__head">
          <h2 class="hd__title">{{ h.icon ? h.icon + ' ' : '' }}{{ h.title }}</h2>
          <span class="hd__meta">
            {{ kindLabel(h.kind) }} · {{ schedule(h) }} · сейчас планка {{ h.ladder.currentTarget }}
          </span>
          @if (h.isStarter) {
            <span class="hd__example">пример</span>
          }
        </header>

        @if (h.isStarter) {
          <app-card>
            <p class="hd__empty">
              Это пример — он ничего не считает, пока ты его не заберёшь себе. Нажми «Добавить
              себе» в списке привычек, и с этого дня здесь начнёт собираться твоя история.
            </p>
          </app-card>
        } @else if (days().length === 0) {
          <app-card>
            <p class="hd__empty">Показать пока нечего — возвращайся позже.</p>
          </app-card>
        } @else {
          @if (silence(); as text) {
            <p class="hd__silence">{{ text }}</p>
          }
          <ul class="hd__list">
            @for (d of days(); track d.occurredOn) {
              <li>
                <app-card>
                  <div class="hd__day">
                    <span class="hd__date">{{ fmtDate(d.occurredOn) }}</span>
                    <span class="hd__event" [attr.data-event]="d.event">{{ eventText(d) }}</span>
                    @if (d.completedAt; as at) {
                      <span class="hd__time">в {{ fmtTime(at) }}</span>
                    }
                    @if (d.event === 'pending' && d.isToday) {
                      <app-button variant="ghost" (click)="toToday()">В «Сегодня»</app-button>
                    }
                  </div>
                  @if (d.ladderMove; as move) {
                    <p class="hd__ladder">
                      {{ move.to > move.from ? '🎉 Планка выросла' : '🌙 Планка стала мягче' }}:
                      {{ move.from }} → {{ move.to }}
                    </p>
                  }
                </app-card>
              </li>
            }
          </ul>
          @if (cursor() !== null) {
            <div class="hd__more">
              <app-button variant="ghost" [loading]="moreBusy()" (click)="loadMore()">
                Показать ещё
              </app-button>
            </div>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .hd {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .hd__back {
        align-self: flex-start;
        padding: 0;
        background: none;
        border: none;
        color: var(--color-accent);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .hd__head {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .hd__title {
        margin: 0;
      }
      .hd__meta,
      .hd__muted,
      .hd__silence {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .hd__silence {
        margin: 0;
      }
      .hd__error {
        color: var(--color-danger);
        font-size: var(--fs-sm);
      }
      .hd__example {
        align-self: flex-start;
        padding: 0 var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }
      .hd__empty {
        margin: 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .hd__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .hd__day {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .hd__time {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }
      .hd__date {
        min-width: 7rem;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .hd__event[data-event='done'] {
        color: var(--color-success);
      }
      .hd__event[data-event='pending'] {
        color: var(--color-text-muted);
      }
      /* Движение планки — герой экрана: единственное место, где видно, что человек стал сильнее. */
      .hd__ladder {
        margin: var(--space-2) 0 0;
        color: var(--color-accent);
        font-size: var(--fs-sm);
      }
      .hd__more {
        display: flex;
        justify-content: center;
      }
    `,
  ],
})
export class HabitDetailComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  /** Привычка (шапка экрана). */
  protected readonly habit = signal<HabitView | null>(null);
  /** Накопленные дни истории. */
  protected readonly days = signal<HabitHistoryDay[]>([]);
  /** Курсор «Показать ещё» или null. */
  protected readonly cursor = signal<string | null>(null);
  /** Первичная загрузка. */
  protected readonly loading = signal(true);
  /** Идёт догрузка страницы. */
  protected readonly moreBusy = signal(false);
  /** Ошибка загрузки. */
  protected readonly error = signal<string | null>(null);
  /** Сколько дней прошло с последней отметки (null — отметок не было). */
  protected readonly daysSince = signal<number | null>(null);
  /** Дата последней отметки или null. */
  protected readonly lastMarkedOn = signal<string | null>(null);

  /** Идентификатор из маршрута. */
  private _id = '';

  /**
   * «Тишина» — факт, а не оценка: сообщаем, когда была последняя отметка, и не называем это
   * пропуском. Сегодняшняя отметка → строку не показываем вовсе, там и так всё видно.
   */
  protected readonly silence = computed(() => {
    const days = this.daysSince();
    if (days === null) {
      return 'Отметок пока не было.';
    }
    if (days <= 0) {
      return null;
    }
    const date = this.lastMarkedOn();
    const when = days === 1 ? 'вчера' : `${days} дн. назад`;
    return date === null ? `Последняя отметка — ${when}.` : `Последняя отметка — ${this.fmtDate(date)} (${when}).`;
  });

  public constructor() {
    this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this._id = params.get('id') ?? '';
      this._load();
    });
  }

  /**
   * Человеческая подпись события дня. Формулировки нейтральные: «не отмечено» вместо
   * «пропущено» — экран сообщает факты, а не выносит приговор.
   * @param day День истории.
   * @returns Текст события.
   */
  protected eventText(day: HabitHistoryDay): string {
    switch (day.event) {
      case 'done':
        return day.doneValue === null
          ? '✓ Сделано'
          : `✓ Сделано: ${day.doneValue}${day.targetValue === null ? '' : ` из ${day.targetValue}`}`;
      case 'partial':
        return `Частично: ${day.doneValue ?? 0}${day.targetValue === null ? '' : ` из ${day.targetValue}`}`;
      case 'postponed':
        return `→ Перенесено на ${day.postponedTo === null ? 'следующий день' : this.fmtDate(day.postponedTo)}`;
      default:
        return day.isToday ? 'Ждёт сегодня' : 'Не отмечено';
    }
  }

  /**
   * Время выполнения — час и минуты. Показываем рядом с отметкой: сервер знал этот момент и
   * молчал о нём (хвост «поля без потребителя», `completedAt`).
   * @param iso Момент выполнения (ISO).
   * @returns Строка вида «21:35».
   */
  protected fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Дата по-человечески.
   * @param ymd Дата `YYYY-MM-DD`.
   * @returns Строка вида «3 августа».
   */
  protected fmtDate(ymd: string): string {
    return new Date(`${ymd}T00:00:00`).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  }

  /**
   * Подпись типа измерения.
   * @param kind Тип.
   * @returns Подпись.
   */
  protected kindLabel(kind: HabitView['kind']): string {
    return HABIT_KIND_LABELS[kind];
  }

  /**
   * Подпись расписания.
   * @param habit Привычка.
   * @returns Текст расписания.
   */
  protected schedule(habit: HabitView): string {
    return recurrenceLabel(habit.recurrence);
  }

  /** Назад к списку привычек. */
  protected back(): void {
    void this._router.navigate(['../'], { relativeTo: this._route });
  }

  /** К задачам дня — там задачу можно выполнить. */
  protected toToday(): void {
    void this._router.navigate(['../'], { relativeTo: this._route });
  }

  /** Догружает следующую страницу истории (keyset). */
  protected loadMore(): void {
    const before = this.cursor();
    if (before === null || this.moreBusy()) {
      return;
    }
    this.moreBusy.set(true);
    this._api.getHabitHistory(this._id, before).subscribe({
      next: (page) => {
        this.days.update((list) => [...list, ...page.items]);
        this.cursor.set(page.nextCursor);
        this.moreBusy.set(false);
      },
      error: () => this.moreBusy.set(false),
    });
  }

  /** Первичная загрузка: привычка + первая страница истории. */
  private _load(): void {
    this.loading.set(true);
    this._api.getHabit(this._id).subscribe({
      next: (habit) => {
        this.habit.set(habit);
        this.error.set(null);
        this._api.getHabitHistory(this._id).subscribe({
          next: (page) => {
            this.days.set(page.items);
            this.cursor.set(page.nextCursor);
            this.daysSince.set(page.daysSinceLastMark);
            this.lastMarkedOn.set(page.lastMarkedOn);
            this.loading.set(false);
          },
          error: (err: unknown) => {
            this.error.set(errorMessage(err));
            this.loading.set(false);
          },
        });
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
