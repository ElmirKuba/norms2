import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import type { AchievementItem, StatsView } from '../accent.types';

/**
 * Статистика раздела (`/accent/stats`, 2.9) — **зеркало, а не табло**.
 *
 * Здесь нет ни одного числа, которое можно набить независимо от жизни: очков и уровней нет,
 * всё выводится из зафиксированных действий. Два числа постоянства отвечают на разные вопросы —
 * итог «кто я» (не падает никогда) и окно «как я сейчас» (восстанавливается само); порознь они
 * врут, поэтому идут парой.
 *
 * **Проверка на каждый элемент экрана:** станет ли хуже, если человек закроет приложение и пойдёт
 * делать? Если да — элемент спроектирован неверно. Поэтому сюда заходят намеренно и нечасто, и
 * экран ничего не требует.
 */
@Component({
  selector: 'app-accent-stats',
  imports: [CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="st">
      @if (loading()) {
        <p class="st__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="st__error">{{ error() }}</p>
      } @else if (data(); as s) {
        <app-card class="st__hero">
          <span class="st__kicker">Постоянство</span>
          <div class="st__kpi-row">
            <strong class="st__kpi">{{ s.persistence.totalDays }}</strong>
            <span class="st__kpi-unit">{{ dayWord(s.persistence.totalDays) }} с действием</span>
          </div>
          <!-- Итог и окно рядом: «37 дней всего» без «5 из 7» умалчивает, что человек ушёл. -->
          <p class="st__note">
            {{ s.persistence.windowDays }} из последних {{ s.persistence.windowSize }} дней
            @if (s.persistence.silenceDays > 0) {
              · последняя отметка {{ s.persistence.silenceDays }}
              {{ dayWord(s.persistence.silenceDays) }} назад
            }
          </p>
          @if (s.persistence.returnCount > 0) {
            <p class="st__return">
              Возвращался после долгого перерыва: {{ s.persistence.returnCount }}
              {{ timesWord(s.persistence.returnCount) }}. Это и есть главное умение.
            </p>
          }
        </app-card>

        @if (s.habits.length > 0) {
          <app-card>
            <span class="st__kicker">По привычкам</span>
            <ul class="st__list">
              @for (habit of s.habits; track habit.habitId) {
                <li class="st__row">
                  <span class="st__row-title">{{ habit.title }}</span>
                  <span class="st__row-value">
                    <strong>{{ habit.persistence.totalDays }}</strong>
                    <span class="st__muted">
                      {{ dayWord(habit.persistence.totalDays) }} · {{ habit.persistence.windowDays }}
                      из {{ habit.persistence.windowSize }}
                    </span>
                  </span>
                </li>
              }
            </ul>
          </app-card>
        }

        <app-card>
          <span class="st__kicker">Достижения · {{ s.awardedCount }} из {{ s.achievements.length }}</span>
          <!-- Невыданные показываем тоже, с подсказкой «как получить»: скрывать их значило бы
               превратить достижения в лотерею. -->
          <ul class="st__grid">
            @for (item of s.achievements; track item.code) {
              <li class="st__badge" [class.st__badge--locked]="item.awardedAt === null">
                <strong class="st__badge-title">{{ item.title }}</strong>
                <span class="st__badge-text">
                  {{ item.awardedAt === null ? item.hint : item.description }}
                </span>
                @if (item.awardedAt !== null) {
                  <span class="st__badge-meta">
                    {{ fmtDate(item.awardedAt) }}{{ item.context ? ' · ' + item.context : '' }}
                  </span>
                }
              </li>
            }
          </ul>
        </app-card>
      }
    </section>
  `,
  styles: [
    `
      .st {
        padding: var(--space-4) 0;
        display: grid;
        gap: var(--space-4);
      }
      .st__kicker {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      /* Тот же приём, что на дашборде: значение крупнее подписи, единица на базовой линии. */
      .st__kpi-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      /* --fs-2xl — верх шкалы токенов (2rem). Своего размера мимо шкалы не заводим: экран
         статистики не важнее дашборда, чтобы ломать ради него типографскую систему.
         (Обратные кавычки в этом комментарии писать нельзя — они рвут шаблонную строку.) */
      .st__kpi {
        font-size: var(--fs-2xl);
        line-height: 1;
      }
      .st__kpi-unit {
        color: var(--color-text-muted);
      }
      .st__hero {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 10%, transparent),
          transparent 60%
        );
      }
      .st__note {
        margin: var(--space-2) 0 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .st__return {
        margin: var(--space-3) 0 0;
        font-size: var(--fs-sm);
      }
      .st__list {
        list-style: none;
        margin: var(--space-3) 0 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      .st__row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .st__row-value {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        white-space: nowrap;
      }
      .st__muted {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .st__grid {
        list-style: none;
        margin: var(--space-3) 0 0;
        padding: 0;
        display: grid;
        gap: var(--space-3);
        grid-template-columns: minmax(0, 1fr);
      }
      @media (min-width: 768px) {
        .st__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (min-width: 1200px) {
        .st__grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      .st__badge {
        display: grid;
        gap: var(--space-1);
        padding: var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
      }
      /* Невыданное приглушено, но не спрятано и не перечёркнуто: это путь, а не отказ. */
      .st__badge--locked {
        opacity: 0.62;
      }
      .st__badge-text {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .st__badge-meta {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }
      .st__muted,
      .st__error {
        color: var(--color-text-muted);
      }
      .st__error {
        color: var(--color-danger);
      }
    `,
  ],
})
export class AccentStatsComponent {
  /** API раздела. */
  private readonly _api = inject(AccentApiService);
  /** Снимок статистики. */
  protected readonly data = signal<StatsView | null>(null);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Текст ошибки или null. */
  protected readonly error = signal<string | null>(null);

  /** Загружает снимок при создании экрана. */
  public constructor() {
    this._api
      .getStats()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (view) => {
          this.data.set(view);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(errorMessage(err));
          this.loading.set(false);
        },
      });
  }

  /**
   * Склонение слова «день» при числе.
   * @param count Число дней.
   * @returns «день» / «дня» / «дней».
   */
  protected dayWord(count: number): string {
    const tens = count % 100;
    const ones = count % 10;
    if (tens >= 11 && tens <= 14) {
      return 'дней';
    }
    if (ones === 1) {
      return 'день';
    }
    if (ones >= 2 && ones <= 4) {
      return 'дня';
    }
    return 'дней';
  }

  /**
   * Склонение слова «раз» при числе.
   * @param count Число раз.
   * @returns «раз» / «раза».
   */
  protected timesWord(count: number): string {
    const tens = count % 100;
    const ones = count % 10;
    if (tens >= 11 && tens <= 14) {
      return 'раз';
    }
    return ones >= 2 && ones <= 4 ? 'раза' : 'раз';
  }

  /**
   * Дата по-человечески.
   * @param iso Момент (ISO).
   * @returns Строка вида «1 августа».
   */
  protected fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  /** Достижение выдано. @param item Достижение. @returns true, если выдано. */
  protected isAwarded(item: AchievementItem): boolean {
    return item.awardedAt !== null;
  }
}
