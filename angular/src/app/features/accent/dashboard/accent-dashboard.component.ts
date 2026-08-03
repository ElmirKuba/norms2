import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { AccentTimerModalComponent } from '../shared/accent-timer-modal.component';
import type { AccentTimerData, AccentTimerResult } from '../shared/accent-timer-modal.component';
import type { DashboardAntiHabitItem, DashboardView } from '../accent.types';

/**
 * Главный экран «Акцента» (2.11) — **кокпит, а не витрина**.
 *
 * Наверху **«Сейчас»**: одно дело и одна кнопка. Выбирает его бэк по правилам
 * ([ADR-0063](../../../../../docs/decisions/0063-no-llm-in-critical-path.md) — ИИ в критическом
 * пути нет); чек-ин состояния (2.8) не добавит блок, а уточнит выбор внутри того же механизма.
 *
 * Ниже — честная сводка дня (2.11·5) и чек-лист первых шагов для новичка (2.11·6). Пустые блоки
 * **не рисуем вовсе**: экран показывает то, что есть, и не изображает наполненность.
 */
@Component({
  selector: 'app-accent-dashboard',
  imports: [RouterLink, ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dash">
      @if (loading()) {
        <p class="dash__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="dash__error">{{ error() }}</p>
      } @else if (data(); as d) {
        @if (showChecklist(d)) {
          <app-card class="dash__tile dash__wide">
            <div class="dash__start">
              <h3 class="dash__block-title">С чего начать</h3>
              <p class="dash__now-hint">Три шага — и раздел начнёт работать на тебя.</p>
              <ol class="dash__steps">
                @for (step of steps(d); track step.key) {
                  <li class="dash__step" [class.dash__step--done]="step.done">
                    <span class="dash__step-mark" aria-hidden="true">{{ step.done ? '✓' : '○' }}</span>
                    <span class="dash__step-text">{{ step.text }}</span>
                    @if (step.active) {
                      <app-button [routerLink]="step.link">{{ step.action }}</app-button>
                    }
                  </li>
                }
              </ol>
            </div>
          </app-card>
        }

        <app-card class="dash__tile dash__tile--hero dash__wide">
          <div class="dash__now" [attr.data-kind]="d.now.kind">
            <span class="dash__now-label">{{ nowLabel(d) }}</span>
            @if (d.now.title; as title) {
              <strong class="dash__now-title">{{ title }}</strong>
            }
            <p class="dash__now-hint">{{ nowHint(d) }}</p>
            @if (d.now.kind !== 'all_done') {
              <div class="dash__now-actions">
                <app-button [loading]="acting()" (click)="act(d)">{{ actionLabel(d) }}</app-button>
                @if (d.now.kind !== 'micro_win') {
                  <app-button variant="ghost" [routerLink]="['../habits']">Все задачи</app-button>
                }
              </div>
            }
          </div>
        </app-card>

        @if (d.today.total > 0) {
          <app-card class="dash__tile dash__tile--today">
            <div class="dash__block">
              <span class="dash__kicker">Сегодня</span>
              <div class="dash__kpi-row">
                <strong class="dash__kpi">{{ d.today.percent }}%</strong>
                <span class="dash__kpi-note">{{ d.today.done }} из {{ d.today.total }}</span>
              </div>
              <div class="dash__bar"><span class="dash__bar-fill" [style.width.%]="d.today.percent"></span></div>
              <ul class="dash__list">
                @for (task of d.today.items; track task.id) {
                  <li class="dash__row">
                    <span class="dash__dot" [attr.data-status]="task.status" aria-hidden="true"></span>
                    <span [class.dash__struck]="task.status === 'done'">{{ task.title }}</span>
                  </li>
                }
              </ul>
              <a class="dash__more" [routerLink]="['../habits']">Все задачи →</a>
            </div>
          </app-card>
        }

        @if (d.overdue.length > 0) {
          <app-card class="dash__tile dash__tile--overdue">
            <div class="dash__block">
              <span class="dash__kicker">Просрочено</span>
              <ul class="dash__list">
                @for (task of d.overdue; track task.id) {
                  <li class="dash__row">
                    <span>{{ task.title }}</span>
                    <span class="dash__muted">срок {{ fmtDate(task.deadline) }}</span>
                  </li>
                }
              </ul>
            </div>
          </app-card>
        }

        @if (d.goals.length > 0) {
          <app-card class="dash__tile dash__tile--goals">
            <div class="dash__block">
              <span class="dash__kicker">Цели</span>
              <ul class="dash__list">
                @for (goal of d.goals; track goal.id) {
                  <li class="dash__row">
                    <a class="dash__link" [routerLink]="['../goals', goal.id]">
                      {{ goal.isFocus ? '⭐ ' : '' }}{{ goal.title }}
                    </a>
                    <span class="dash__bar dash__bar--thin">
                      <span class="dash__bar-fill" [style.width.%]="goal.percentage ?? 0"></span>
                    </span>
                    <span class="dash__muted">{{ goal.percentage === null ? '—' : goal.percentage + '%' }}</span>
                  </li>
                }
              </ul>
              <a class="dash__more" [routerLink]="['../goals']">Все цели →</a>
            </div>
          </app-card>
        }

        @if (d.antiHabits.length > 0) {
          <app-card class="dash__tile dash__tile--anti">
            <div class="dash__block">
              <span class="dash__kicker">Держусь</span>
              @if (soleAntiHabit(d); as only) {
                <!-- Одна серия — показываем её как счётчик: число крупно, название мелко. -->
                <div class="dash__kpi-row">
                  <strong class="dash__kpi">{{ heldFor(only.currentAttemptStartedAt) }}</strong>
                </div>
                <a class="dash__link dash__kpi-note" [routerLink]="['../anti-habits', only.id]">
                  {{ only.title }}
                </a>
              } @else {
                <ul class="dash__list">
                  @for (item of d.antiHabits; track item.id) {
                    <li class="dash__row">
                      <a class="dash__link" [routerLink]="['../anti-habits', item.id]">{{ item.title }}</a>
                      <span class="dash__streak">{{ heldFor(item.currentAttemptStartedAt) }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          </app-card>
        }

        @if (d.hasObstacles) {
          <p class="dash__obstacles dash__wide">
            Накрыло? <a class="dash__link" [routerLink]="['../obstacles']">Отметить, что помешало →</a>
          </p>
        }

        @if (d.pausedFrom !== null) {
          <div class="dash__paused dash__wide">
            <span>Раздел на паузе с {{ pausedLabel(d.pausedFrom) }} — вернёшься, когда будешь готов.</span>
            <app-button variant="ghost" [loading]="busy()" (click)="resume()">Снять паузу</app-button>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      /* Бенто-сетка: иерархия делается РАЗМЕРОМ плитки, а не цветом. Мобильный — одна колонка
         (порядок = приоритет), планшет — две, десктоп — четыре с крупной плиткой дня.
         Пустые блоки не рисуются вовсе, поэтому сетка должна переживать дыры: спаны заданы так,
         что оставшиеся плитки просто перетекают, а не оставляют пустые клетки. */
      .dash {
        /* Тот же воздух, что у остальных экранов раздела: без него карточки липнут к
           вкладкам сверху и к краю снизу. */
        padding: var(--space-4) 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-4);
      }
      .dash__wide {
        grid-column: 1 / -1;
      }
      @media (min-width: 768px) {
        .dash {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (min-width: 1200px) {
        .dash {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        /* День — вторая по важности вещь после «Сейчас»: занимает половину ширины и две строки.
           Больше двух «героев» на экран не делаем — глазу нужен один якорь. */
        .dash__tile--today {
          grid-column: span 2;
          grid-row: span 2;
        }
        .dash__tile--goals {
          grid-column: span 2;
        }
      }
      /* Тема-зависимый градиент: почти незаметный тёплый отсвет от акцента. Не неон из трендов —
         раздел про спокойствие; цвет берём из переменной темы, поэтому он живёт и в светлой, и в
         тёмной. Если color-mix не поддержан — просто не будет градиента, вёрстка цела. */
      .dash__tile {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 5%, transparent),
          transparent 55%
        );
      }
      .dash__tile--hero {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 13%, transparent),
          transparent 70%
        );
      }
      .dash__tile--overdue {
        background-image: linear-gradient(
          150deg,
          color-mix(in srgb, var(--color-accent) 10%, transparent),
          transparent 60%
        );
      }
      /* Подпись-надзаголовок: мелкая и приглушённая, потому что крупным идёт ЗНАЧЕНИЕ. */
      .dash__kicker {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .dash__kpi-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
      }
      .dash__kpi {
        font-size: var(--fs-2xl);
        line-height: 1.1;
      }
      .dash__kpi-note {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .dash__muted {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .dash__error {
        color: var(--color-danger);
        font-size: var(--fs-sm);
      }
      .dash__now {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .dash__now-label {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .dash__now-title {
        font-size: var(--fs-xl);
        line-height: 1.2;
      }
      .dash__now-hint {
        margin: 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      /* Просрочка — единственное, что уже подвело: выделяем акцентом, но без красной паники. */
      .dash__now[data-kind='overdue'] .dash__now-label {
        color: var(--color-accent);
      }
      .dash__now-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-top: var(--space-1);
      }
      .dash__start {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .dash__steps {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
        counter-reset: step;
      }
      .dash__step {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--fs-sm);
      }
      .dash__step--done .dash__step-text {
        color: var(--color-text-muted);
        text-decoration: line-through;
      }
      .dash__step-mark {
        color: var(--color-accent);
        flex-shrink: 0;
      }
      .dash__step-text {
        flex: 1;
      }
      .dash__block {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .dash__block-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .dash__block-title {
        margin: 0;
        font-size: var(--fs-md);
      }
      .dash__pct {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .dash__bar {
        height: 6px;
        background: var(--color-surface-2);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .dash__bar--thin {
        flex: 1;
        min-width: 4rem;
      }
      .dash__bar-fill {
        display: block;
        height: 100%;
        background: var(--color-accent);
      }
      .dash__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .dash__row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--fs-sm);
      }
      .dash__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-border);
        flex-shrink: 0;
      }
      .dash__dot[data-status='done'] {
        background: var(--color-success);
      }
      .dash__dot[data-status='partial'] {
        background: var(--color-accent);
      }
      .dash__struck {
        color: var(--color-text-muted);
        text-decoration: line-through;
      }
      .dash__link {
        color: inherit;
        text-decoration: none;
      }
      .dash__link:hover {
        color: var(--color-accent);
        text-decoration: underline;
      }
      .dash__more {
        align-self: flex-start;
        color: var(--color-accent);
        font-size: var(--fs-sm);
        text-decoration: none;
      }
      .dash__streak {
        margin-left: auto;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      /* Короткий путь к помощи в плохую минуту — не список, одна строка. */
      .dash__obstacles {
        margin: 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .dash__paused {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
    `,
  ],
})
export class AccentDashboardComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _modal = inject(ModalService);
  private readonly _dialog = inject(MatDialog);
  private readonly _router = inject(Router);

  /** Снимок главного экрана. */
  protected readonly data = signal<DashboardView | null>(null);
  /** Первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки. */
  protected readonly error = signal<string | null>(null);
  /** Идёт действие по «Сейчас». */
  protected readonly acting = signal(false);
  /** Идёт снятие паузы. */
  protected readonly busy = signal(false);

  public constructor() {
    this._load();
  }

  /**
   * Показывать ли чек-лист первых шагов. Исчезает, как только пройдены все три: дальше человек
   * знает, что делать, и напоминание превращается в шум.
   * @param view Снимок.
   * @returns true, если что-то из трёх ещё не сделано.
   */
  protected showChecklist(view: DashboardView): boolean {
    const { hasHabits, hasFirstCompletion, hasGoals } = view.onboarding;
    return !hasHabits || !hasFirstCompletion || !hasGoals;
  }

  /**
   * Три шага первого знакомства. **Кнопка только у первого невыполненного** — путь видно
   * целиком, а делать нужно одно: выбор из пяти дверей на старте парализует сильнее, чем пустой
   * экран.
   * @param view Снимок.
   * @returns Шаги в порядке прохождения.
   */
  protected steps(
    view: DashboardView,
  ): { key: string; text: string; action: string; link: string[]; done: boolean; active: boolean }[] {
    const { hasHabits, hasFirstCompletion, hasGoals } = view.onboarding;
    const raw = [
      {
        key: 'habit',
        text: 'Заведи привычку — маленькую, которую точно потянешь',
        action: 'К привычкам',
        link: ['../habits'],
        done: hasHabits,
      },
      {
        key: 'mark',
        text: 'Отметь её хоть раз — так система начнёт подстраивать планку',
        action: 'Открыть день',
        link: ['../habits'],
        done: hasFirstCompletion,
      },
      {
        key: 'goal',
        text: 'Поставь цель — чтобы шаги вели куда-то',
        action: 'К целям',
        link: ['../goals'],
        done: hasGoals,
      },
    ];
    const firstOpen = raw.findIndex((step) => !step.done);
    return raw.map((step, index) => ({ ...step, active: index === firstOpen }));
  }

  /**
   * Подпись над делом — простыми словами, как везде в разделе.
   * @param view Снимок.
   * @returns Подпись.
   */
  protected nowLabel(view: DashboardView): string {
    switch (view.now.kind) {
      case 'overdue':
        return 'Подгорает';
      case 'task':
        return 'Сейчас';
      case 'micro_win':
        return 'Если есть силы';
      default:
        return 'На сегодня всё';
    }
  }

  /**
   * Пояснение под делом. Для «всё сделано» — похвала, а не выдуманное дело; для пустого дня —
   * «так и должно быть», чтобы отсутствие задач не читалось как упрёк.
   * @param view Снимок.
   * @returns Текст.
   */
  protected nowHint(view: DashboardView): string {
    switch (view.now.kind) {
      case 'overdue':
        return 'Срок прошёл — но сделать всё ещё можно.';
      case 'task':
        return 'Одно дело. Не список — просто начни с него.';
      case 'micro_win':
        return 'День закрыт. Это по желанию, не обязанность.';
      default:
        return view.today.total > 0
          ? 'Всё закрыто. Отдыхай — этого достаточно.'
          : 'Сегодня по расписанию ничего нет. Это нормально.';
    }
  }

  /**
   * Подпись кнопки действия.
   * @param view Снимок.
   * @returns Подпись.
   */
  protected actionLabel(view: DashboardView): string {
    return view.now.kind === 'micro_win' ? '▶ Сделать' : 'Открыть';
  }

  /**
   * Действие по «Сейчас». Микро-победу запускаем таймером прямо здесь — от «хочу» до «делаю»
   * один тап; задачу открываем в «Привычках», где живут её кнопки и ввод значения (дублировать
   * их на дашборде значило бы завести второй экран задач).
   * @param view Снимок.
   */
  protected act(view: DashboardView): void {
    if (view.now.kind === 'micro_win' && view.now.microWinId !== null) {
      this._runMicroWin(view.now.microWinId, view.now.title ?? '');
      return;
    }
    void this._router.navigate(['/app/accent/habits']);
  }

  /** Снимает паузу раздела. */
  protected resume(): void {
    this.busy.set(true);
    this._api.resume().subscribe({
      next: () => {
        this.busy.set(false);
        this._load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this._modal.error('Не удалось снять с паузы', errorMessage(err));
      },
    });
  }

  /**
   * Единственная серия «держусь» или null. Отдельный метод, потому что шаблон Angular не даст
   * обратиться к `antiHabits[0]` напрямую: под `noUncheckedIndexedAccess` элемент может быть
   * `undefined`, и компилятор шаблонов это ловит (а `tsc` — нет).
   * @param view Снимок.
   * @returns Серия или null.
   */
  protected soleAntiHabit(view: DashboardView): DashboardAntiHabitItem | null {
    return view.antiHabits.length === 1 ? (view.antiHabits[0] ?? null) : null;
  }

  /**
   * Сколько держится серия — считаем **на фронте** от момента старта: снимок в днях устарел бы
   * через минуту после загрузки. Целые сутки, без секундной точности: на дашборде важен порядок,
   * а живой таймер живёт на своём экране.
   * @param startedAt Момент старта попытки (unix ms).
   * @returns Строка вида «12 дн.».
   */
  protected heldFor(startedAt: number): string {
    const days = Math.max(0, Math.floor((Date.now() - startedAt) / 86_400_000));
    if (days === 0) {
      return 'сегодня';
    }
    return `${days} дн.`;
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
   * Дата начала паузы по-человечески.
   * @param iso Момент (ISO).
   * @returns Строка.
   */
  protected pausedLabel(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Запускает таймер микро-победы и по зачёту перечитывает снимок: «Сейчас» сразу становится
   * следующим делом, а не остаётся с уже сделанным.
   * @param microWinId Идентификатор микро-победы.
   * @param title Название (заголовок таймера).
   */
  private _runMicroWin(microWinId: string, title: string): void {
    const ref = this._dialog.open<
      AccentTimerModalComponent,
      AccentTimerData,
      AccentTimerResult | null
    >(AccentTimerModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      disableClose: true,
      data: { title, durationSeconds: 60, prepSeconds: null, mode: 'binary' },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.status !== 'done') {
        return;
      }
      this.acting.set(true);
      this._api.completeMicroWin(microWinId).subscribe({
        next: () => {
          this.acting.set(false);
          this._load();
        },
        error: (err: unknown) => {
          this.acting.set(false);
          this._modal.error('Не удалось засчитать', errorMessage(err));
        },
      });
    });
  }

  /** Загружает снимок главного экрана. */
  private _load(): void {
    this.loading.set(true);
    this._api.getDashboard().subscribe({
      next: (view) => {
        this.data.set(view);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
