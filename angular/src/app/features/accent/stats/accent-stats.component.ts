import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import type { AchievementItem, PersistenceView, StatsView } from '../accent.types';

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
        <app-card class="st__tile st__tile--hero">
          <span class="st__kicker">Постоянство</span>
          <!-- Число героем, единица под ним мелким капсом: глаз хватает величину раньше, чем
               читает слова. Приём из спортивных трекеров, но без их накачки — тон у нас
               спокойный, никаких лозунгов. -->
          <div class="st__kpi-stack">
            <strong class="st__kpi">{{ s.persistence.totalDays }}</strong>
            <span class="st__kpi-unit">{{ dayWord(s.persistence.totalDays) }} с действием</span>
          </div>
          <!-- Неделя точками: пять залитых из семи читаются быстрее строки «5 из 7» и не
               выглядят оценкой — это просто отметки на календаре, а не счёт очков. -->
          <div class="st__week" [attr.aria-label]="weekLabel(s)">
            @for (slot of weekSlots(s); track $index) {
              <span class="st__dot" [class.st__dot--on]="slot"></span>
            }
            <span class="st__week-note">
              {{ s.persistence.windowDays }} из {{ s.persistence.windowSize }} последних дней
            </span>
          </div>
          @if (s.persistence.silenceDays > 0 && s.persistence.lastActiveOn !== null) {
            <p class="st__note">
              Последняя отметка {{ fmtDay(s.persistence.lastActiveOn) }} — это
              {{ s.persistence.silenceDays }} {{ dayWord(s.persistence.silenceDays) }} назад.
            </p>
          }
          @if (s.persistence.returnCount > 0) {
            <p class="st__return">
              Возвращался после долгого перерыва: {{ s.persistence.returnCount }}
              {{ timesWord(s.persistence.returnCount) }}{{ lastReturnNote(s) }}. Это и есть
              главное умение.
            </p>
          }
        </app-card>

        <!-- Счётчик достижений отдельной плиткой: число крупно, сетка карточек ниже свободна
             от заголовка. Разные размеры плиток — ритм экрана, как на дашборде. -->
        <app-card class="st__tile st__tile--count">
          <span class="st__kicker">Достижения</span>
          <div class="st__kpi-stack">
            <strong class="st__kpi">{{ s.awardedCount }}</strong>
            <span class="st__kpi-unit">из {{ s.achievements.length }} получено</span>
          </div>
          <!-- У достижений есть естественный потолок — здесь полоса честна. У «дней с
               действием» потолка нет, поэтому там точки окна, а не заполнение. -->
          <span class="st__bar st__bar--wide">
            <span class="st__bar-fill" [style.width.%]="awardedPercent(s)"></span>
          </span>
          @if (awardedNote(s) !== null) {
            <span class="st__week-note">{{ awardedNote(s) }}</span>
          }
        </app-card>

        @if (s.habits.length > 0) {
          <app-card class="st__tile st__tile--habits">
            <span class="st__kicker">По привычкам</span>
            <ul class="st__list">
              @for (habit of s.habits; track habit.habitId) {
                <li class="st__row">
                  <span class="st__row-title">{{ habit.title }}</span>
                  <!-- Полоска окна — та же идея, что у целей на дашборде: видно ритм, а не
                       только цифру. -->
                  <span class="st__bar">
                    <span
                      class="st__bar-fill"
                      [style.width.%]="windowPercent(habit.persistence)"
                    ></span>
                  </span>
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

        <!-- Невыданные показываем тоже, с подсказкой «как получить»: скрывать их значило бы
             превратить достижения в лотерею. Полученные — с градиентом и акцентной рамкой,
             чтобы разница «есть / впереди» читалась мгновенно. -->
        <ul class="st__grid st__wide">
          @for (item of s.achievements; track item.code) {
            <li
              class="st__badge"
              [class.st__badge--locked]="item.awardedAt === null"
              [class.st__badge--fresh]="item.code === freshCode(s)"
            >
              <span class="st__badge-mark" aria-hidden="true">
                {{ item.awardedAt === null ? '○' : '●' }}
              </span>
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
      }
    </section>
  `,
  styles: [
    `
      /* Бенто, как на дашборде: разные размеры плиток дают ритм, а одинаковые строки друг под
         другом читаются как таблица и усыпляют. */
      .st {
        padding: var(--space-4) 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-4);
      }
      .st__wide {
        grid-column: 1 / -1;
      }
      @media (min-width: 900px) {
        .st {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .st__tile--hero {
          grid-column: span 2;
        }
        .st__tile--habits {
          grid-column: 1 / -1;
        }
      }
      /* Тема-зависимые градиенты через color-mix — цвет берётся из переменной темы, поэтому
         живёт и в светлой, и в тёмной; не поддержан — просто не будет градиента. */
      .st__tile {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 6%, transparent),
          transparent 55%
        );
      }
      .st__tile--hero {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 13%, transparent),
          transparent 70%
        );
      }
      .st__tile--count {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 9%, transparent),
          transparent 60%
        );
      }
      /* Неделя точками: залитые — дни с действием. Точка, а не полоса, потому что дни
         дискретны; полоса намекала бы на «процент выполнения». */
      .st__week {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: var(--space-3);
        flex-wrap: wrap;
      }
      .st__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid color-mix(in srgb, var(--color-accent) 45%, transparent);
      }
      .st__dot--on {
        background: var(--color-accent);
        border-color: var(--color-accent);
      }
      .st__week-note {
        margin-left: var(--space-2);
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .st__bar {
        display: block;
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: color-mix(in srgb, var(--color-accent) 16%, transparent);
        overflow: hidden;
      }
      .st__bar-fill {
        display: block;
        height: 100%;
        background: var(--color-accent);
      }
      .st__bar--wide {
        display: block;
        max-width: none;
        height: 6px;
        margin-top: var(--space-3);
      }
      .st__kicker {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      /* Число и единица столбиком: значение хватается глазом мгновенно, слова читаются вторым
         заходом. На дашборде единица стоит рядом на базовой линии — там плитка мелкая и места
         под столбик нет. (Обратные кавычки в комментариях писать нельзя — рвут строку styles.) */
      .st__kpi-stack {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: var(--space-2);
      }
      .st__kpi {
        font-size: var(--fs-3xl);
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .st__kpi-unit {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
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
      /* Сетка, а не flex: полосы обязаны стоять в одной колонке, иначе они «плавают» вслед за
         длиной названия и строки перестают читаться как список. */
      .st__row {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: baseline;
        gap: var(--space-2);
      }
      @media (min-width: 700px) {
        .st__row {
          grid-template-columns: minmax(0, 1fr) 160px minmax(0, 190px);
          gap: var(--space-3);
        }
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
      /* Полученное достижение — с заливкой и акцентной рамкой: разница «есть / впереди» должна
         читаться до чтения текста. */
      .st__badge {
        display: grid;
        gap: var(--space-1);
        padding: var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-accent) 38%, var(--color-border));
        border-radius: var(--radius-md);
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 11%, transparent),
          transparent 65%
        );
      }
      /* Свежайшее полученное — крупнее остальных: у экрана появляется точка входа для глаза. */
      @media (min-width: 900px) {
        .st__badge--fresh {
          grid-column: span 2;
        }
      }
      /* Невыданное приглушено, но не спрятано и не перечёркнуто: это путь, а не отказ.
         Пунктир вместо сплошной рамки — «ещё не заполнено». */
      .st__badge--locked {
        opacity: 0.72;
        border-style: dashed;
        border-color: var(--color-border);
        background-image: none;
      }
      .st__badge-mark {
        color: var(--color-accent);
        font-size: var(--fs-sm);
        line-height: 1;
      }
      .st__badge--locked .st__badge-mark {
        color: var(--color-text-muted);
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
   * Слоты недели для точечного индикатора: `true` — день с действием. Конкретные даты нам
   * неизвестны (бэк отдаёт только счётчик), поэтому заливаем первые `windowDays` — индикатор
   * показывает **сколько**, а не **какие именно** дни, и календарём не притворяется.
   * @param stats Снимок.
   * @returns Массив длиной `windowSize`.
   */
  protected weekSlots(stats: StatsView): boolean[] {
    return Array.from({ length: stats.persistence.windowSize }, (_, i) => i < stats.persistence.windowDays);
  }

  /**
   * Подпись индикатора для скринридера — точки ему ничего не говорят.
   * @param stats Снимок.
   * @returns Текст.
   */
  protected weekLabel(stats: StatsView): string {
    return `${stats.persistence.windowDays} из ${stats.persistence.windowSize} последних дней с действием`;
  }

  /**
   * Доля окна в процентах — для полоски у привычки.
   * @param persistence Постоянство привычки.
   * @returns 0..100.
   */
  protected windowPercent(persistence: PersistenceView): number {
    return persistence.windowSize === 0
      ? 0
      : Math.round((persistence.windowDays / persistence.windowSize) * 100);
  }

  /**
   * Доля собранных достижений в процентах.
   * @param stats Снимок.
   * @returns 0..100.
   */
  protected awardedPercent(stats: StatsView): number {
    return stats.achievements.length === 0
      ? 0
      : Math.round((stats.awardedCount / stats.achievements.length) * 100);
  }

  /**
   * Строка под счётчиком достижений. Без «осталось N» — это язык задолженности, а достижения
   * не долг.
   * @param stats Снимок.
   * @returns Текст.
   */
  protected awardedNote(stats: StatsView): string | null {
    if (stats.awardedCount === 0) {
      return 'пока ни одного — всё впереди';
    }
    // В обычном состоянии молчим: счётчик над полосой уже всё сказал, а лишняя строка —
    // это шум, который экран статистики должен избегать особенно старательно.
    return stats.awardedCount === stats.achievements.length ? 'собраны все' : null;
  }

  /**
   * Код самого свежего полученного достижения — оно рисуется крупнее остальных.
   * @param stats Снимок.
   * @returns Код или null.
   */
  protected freshCode(stats: StatsView): string | null {
    const awarded = stats.achievements.filter((item) => item.awardedAt !== null);
    if (awarded.length === 0) {
      return null;
    }
    return awarded.reduce((latest, item) =>
      (item.awardedAt ?? '') > (latest.awardedAt ?? '') ? item : latest,
    ).code;
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

  /**
   * Локальная дата `YYYY-MM-DD` по-человечески. Разбираем по частям, а не через `new Date(iso)`:
   * строка без времени трактуется как UTC-полночь, и у кого таймзона позади — дата съезжала бы
   * на день назад.
   * @param ymd Дата `YYYY-MM-DD`.
   * @returns Строка вида «3 августа».
   */
  protected fmtDay(ymd: string): string {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  }

  /**
   * Хвост строки о возвращениях: «, последний раз — после 18 дней тишины». Отдельным методом,
   * потому что вкладывать `@if` в середину предложения — верный способ получить лишний пробел
   * перед запятой.
   * @param stats Снимок.
   * @returns Хвост или пустая строка.
   */
  protected lastReturnNote(stats: StatsView): string {
    const silence = stats.persistence.lastReturnSilenceDays;
    return silence === null ? '' : `, последний раз — после ${silence} ${this.dayWord(silence)} тишины`;
  }

  /** Достижение выдано. @param item Достижение. @returns true, если выдано. */
  protected isAwarded(item: AchievementItem): boolean {
    return item.awardedAt !== null;
  }
}
