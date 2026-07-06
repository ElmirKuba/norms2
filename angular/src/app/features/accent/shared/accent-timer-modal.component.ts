import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/**
 * Режим зачёта — таймер должен знать, откуда открыт (иначе «Готово раньше» врёт факт):
 * - `binary` — микро-победы: факт бинарный, длительность не важна; «Готово раньше» = засчитать полностью.
 * - `duration` — `timed`-привычки: длительность И ЕСТЬ цель; кнопка «Засчитать сейчас» возвращает
 *   реально прошедшие секунды (частичный зачёт: `partial ≥ minTarget` держит серию).
 */
export type AccentTimerMode = 'binary' | 'duration';

/** Данные таймера: что, на сколько и в каком режиме зачёта. */
export interface AccentTimerData {
  /** Название действия (заголовок фокус-экрана). */
  title: string;
  /** Полная длительность действия в секундах (> 0) — вариант «начать сначала». */
  durationSeconds: number;
  /** Время на подготовку в секундах (опц.; null/0 = без подготовки, сразу действие). */
  prepSeconds: number | null;
  /** Откуда открыт таймер — определяет семантику «Готово раньше»/зачёта. */
  mode: AccentTimerMode;
  /**
   * Остаток для «продолжить с места» (опц.). Если задан и `0 < resumeSeconds < durationSeconds` —
   * первый экран предлагает ВЫБОР: «Продолжить (остаток)» или «Начать сначала (полная длительность)».
   */
  resumeSeconds?: number | null;
}

/**
 * Результат: `done` + сколько секунд действия фактически пройдено (`performedSeconds`) и был ли выбран
 * рестарт (`fromRestart`: true → зачесть как есть/заменить; false → «продолжить» → вызывающий
 * прибавляет к уже сделанному). Для `binary` `performedSeconds` = вся длительность. Иначе — `cancel`.
 */
export type AccentTimerResult =
  | { status: 'done'; performedSeconds: number; fromRestart: boolean }
  | { status: 'cancel' };

// Ключ прежний (был у таймера микро-побед) — чтобы сохранить выбор звука пользователей при обобщении.
const SOUND_KEY = 'accent.microWinTimer.sound';

/**
 * Единый фокус-таймер обратного отсчёта для трекеров «Акцента» ([ADR-0057]): крупный отсчёт на
 * спокойном экране — превращает телефон в одну считающую поверхность вместо ленты (anti-doomscroll,
 * [[accent-core-why-anti-doomscroll]]). На нуле — мягкий звук (опц., по умолч. вкл) и вопрос
 * «Сделал?»: засчитываем по подтверждению, не автоматом. Бэк не нужен — завершение делает
 * вызывающий (микро-победа → `completeMicroWin`; `timed`-привычка → `completeTask`, FEAT-H1).
 * Тексты просто ([[ui-copy-plain-simple]]). «Живой таймер» анти-привычек (счёт-вверх) — ДРУГОЙ
 * компонент, сюда не сводится ([ADR-0057]).
 */
@Component({
  selector: 'app-accent-timer-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tm" [class.tm--ask]="phase() === 'ask'">
      <button type="button" class="tm__sound" [attr.aria-label]="soundOn() ? 'Звук включён' : 'Звук выключен'"
        (click)="toggleSound()">{{ soundOn() ? '🔔' : '🔕' }}</button>

      <h2 class="tm__title">{{ data.title }}</h2>

      @if (phase() === 'choose') {
        <p class="tm__phase">Уже засчитано — продолжить или заново?</p>
        <div class="tm__foot tm__foot--col">
          <app-button (click)="chooseResume()">▶ Продолжить (осталось {{ fmt(data.resumeSeconds ?? 0) }})</app-button>
          <app-button variant="ghost" (click)="chooseRestart()">↻ Начать сначала ({{ fmt(data.durationSeconds) }})</app-button>
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
        </div>
      } @else if (phase() === 'prep') {
        <p class="tm__phase">Подготовка — приготовься 🧍</p>
        <div class="tm__clock" role="timer" [attr.aria-label]="'Подготовка: ' + clock()">{{ clock() }}</div>
        <div class="tm__bar"><span class="tm__bar-fill" [style.width.%]="progress()"></span></div>
        <div class="tm__foot">
          <app-button (click)="skipPrep()">Начать сейчас</app-button>
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
        </div>
      } @else if (phase() === 'running') {
        @if (paused()) { <p class="tm__phase">На паузе ⏸</p> }
        <div class="tm__clock" role="timer" [attr.aria-label]="'Осталось ' + clock()">{{ clock() }}</div>
        <div class="tm__bar"><span class="tm__bar-fill" [style.width.%]="progress()"></span></div>
        <div class="tm__foot">
          <app-button variant="ghost" (click)="togglePause()">{{ paused() ? '▶ Продолжить' : '⏸ Пауза' }}</app-button>
          <app-button (click)="finishEarly()">{{ data.mode === 'duration' ? 'Засчитать сейчас' : 'Готово раньше' }}</app-button>
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
        </div>
      } @else {
        <div class="tm__clock tm__clock--done">0:00</div>
        <p class="tm__ask">Сделал?</p>
        <div class="tm__foot">
          <app-button (click)="confirmDone()">✓ Засчитать</app-button>
          <app-button variant="ghost" (click)="cancel()">Не сейчас</app-button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .tm {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-6) var(--space-4);
        text-align: center;
      }
      .tm__sound {
        position: absolute;
        top: var(--space-2);
        right: var(--space-2);
        padding: var(--space-1);
        background: none;
        border: none;
        cursor: pointer;
        font-size: var(--fs-lg);
        line-height: 1;
        opacity: 0.7;
      }
      .tm__sound:hover {
        opacity: 1;
      }
      .tm__title {
        margin: 0;
        font-size: var(--fs-md);
        color: var(--color-text);
      }
      .tm__phase {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .tm__clock {
        font-size: 4rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--color-accent);
        line-height: 1;
      }
      .tm__clock--done {
        color: var(--color-text-muted);
      }
      .tm__bar {
        width: 100%;
        height: 6px;
        border-radius: var(--radius-pill, 999px);
        background: var(--color-surface-2);
        overflow: hidden;
      }
      .tm__bar-fill {
        display: block;
        height: 100%;
        background: var(--color-accent);
        transition: width 1s linear;
      }
      .tm__ask {
        margin: 0;
        font-size: var(--fs-md);
        color: var(--color-text);
      }
      .tm__foot {
        display: flex;
        gap: var(--space-2);
        justify-content: center;
        flex-wrap: wrap;
      }
      .tm__foot--col {
        flex-direction: column;
        align-items: stretch;
        width: 100%;
      }
    `,
  ],
})
export class AccentTimerModalComponent implements OnDestroy {
  private readonly _ref =
    inject<MatDialogRef<AccentTimerModalComponent, AccentTimerResult | null>>(MatDialogRef);
  /** Данные таймера. */
  protected readonly data = inject<AccentTimerData>(MAT_DIALOG_DATA);

  /** Есть ли фаза подготовки. */
  private readonly _hasPrep = (this.data.prepSeconds ?? 0) > 0;
  /** Нужен ли экран выбора «продолжить/сначала» (есть валидный остаток меньше полной длительности). */
  private readonly _hasChoice =
    (this.data.resumeSeconds ?? 0) > 0 && (this.data.resumeSeconds ?? 0) < this.data.durationSeconds;
  /** Длительность выбранного действия (по умолчанию полная; «продолжить» ставит остаток). */
  private readonly _actionSeconds = signal(this.data.durationSeconds);
  /** Был ли выбран рестарт (true → зачесть как есть; false → «продолжить» → вызывающий накопит). */
  private _fromRestart = true;
  /** Оставшиеся секунды (в фазе выбора — 0, экран без часов). */
  protected readonly remaining = signal(
    this._hasChoice ? 0 : this._hasPrep ? (this.data.prepSeconds ?? 0) : this.data.durationSeconds,
  );
  /** Фаза: выбор / подготовка / действие / «Сделал?». */
  protected readonly phase = signal<'choose' | 'prep' | 'running' | 'ask'>(
    this._hasChoice ? 'choose' : this._hasPrep ? 'prep' : 'running',
  );
  /** Звук (по умолчанию вкл; запоминается в localStorage). */
  protected readonly soundOn = signal(this._readSound());
  /** На паузе ли отсчёт (интервал тикает, но время не убывает). */
  protected readonly paused = signal(false);

  /** Формат m:ss. */
  protected fmt(s: number): string {
    const x = Math.max(0, Math.floor(s));
    return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
  }

  /** Отсчёт в формате m:ss. */
  protected readonly clock = computed(() => this.fmt(this.remaining()));
  /** Доля пройденного времени текущей фазы (для полосы). */
  protected readonly progress = computed(() => {
    const total = this.phase() === 'prep' ? (this.data.prepSeconds ?? 0) : this._actionSeconds();
    return total > 0 ? ((total - this.remaining()) / total) * 100 : 100;
  });

  private _intervalId: ReturnType<typeof setInterval> | null = null;
  /** Персистентный аудио-контекст (создаётся лениво, «разблокируется» пользовательским жестом). */
  private _audioCtx: AudioContext | null = null;

  /**
   * Разблокировка аудио: `resume()` контекста ДОЛЖЕН произойти внутри пользовательского жеста
   * (иначе iOS Safari держит контекст `suspended` и звук не играет; Android/десктоп мягче).
   * Arrow-поле — стабильная ссылка для add/removeEventListener. Идемпотентно и дёшево.
   */
  private readonly _unlockAudio = (): void => {
    const ctx = this._ensureAudioCtx();
    if (ctx !== null && ctx.state === 'suspended') {
      void ctx.resume();
    }
  };

  public constructor() {
    this._intervalId = setInterval(() => this._tick(), 1000);
    // Готовим/будим аудио: best-effort сейчас (конструктор — в стеке клика, открывшего модалку) +
    // на первом тапе где угодно (capture, чтобы поймать раньше). Снимаем слушатели в ngOnDestroy.
    this._unlockAudio();
    document.addEventListener('pointerdown', this._unlockAudio, true);
    document.addEventListener('touchstart', this._unlockAudio, true);
  }

  public ngOnDestroy(): void {
    this._stop();
    document.removeEventListener('pointerdown', this._unlockAudio, true);
    document.removeEventListener('touchstart', this._unlockAudio, true);
    void this._audioCtx?.close();
    this._audioCtx = null;
  }

  /** Лениво создаёт аудио-контекст (Web Audio; webkit-префикс для старых Safari). */
  private _ensureAudioCtx(): AudioContext | null {
    if (this._audioCtx === null) {
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx === undefined) {
        return null;
      }
      try {
        this._audioCtx = new Ctx();
      } catch {
        return null;
      }
    }
    return this._audioCtx;
  }

  /**
   * Тик раз в секунду. На нуле подготовки — звук «старт» и переход к отсчёту действия (интервал не
   * останавливаем). На нуле действия — звук «финиш» и переход к «Сделал?».
   */
  private _tick(): void {
    if (this.paused()) {
      return; // на паузе время не убывает
    }
    if (this.phase() !== 'prep' && this.phase() !== 'running') {
      return; // фазы выбора/«Сделал?» не тикают
    }
    const next = this.remaining() - 1;
    this.remaining.set(next);
    if (next > 0) {
      return;
    }
    if (this.phase() === 'prep') {
      this._beginAction();
    } else {
      this._stop();
      this.remaining.set(0);
      this.phase.set('ask');
      if (this.soundOn()) {
        this._chime();
      }
    }
  }

  /** Завершает подготовку → отсчёт действия: звук «старт», сброс остатка на длительность действия. */
  private _beginAction(): void {
    if (this.soundOn()) {
      this._startChime();
    }
    this.phase.set('running');
    this.remaining.set(this._actionSeconds());
  }

  /** Пропустить подготовку — сразу к действию. */
  protected skipPrep(): void {
    this._beginAction();
  }

  /** Выбор «Продолжить»: длительность = остаток, зачёт накопительный (вызывающий прибавит к сделанному). */
  protected chooseResume(): void {
    this._actionSeconds.set(this.data.resumeSeconds ?? this.data.durationSeconds);
    this._fromRestart = false;
    this._enterAction();
  }

  /** Выбор «Начать сначала»: полная длительность, зачёт заменяет прежний прогресс. */
  protected chooseRestart(): void {
    this._actionSeconds.set(this.data.durationSeconds);
    this._fromRestart = true;
    this._enterAction();
  }

  /** После выбора: подготовка (если есть) или сразу отсчёт действия. */
  private _enterAction(): void {
    if (this._hasPrep) {
      this.phase.set('prep');
      this.remaining.set(this.data.prepSeconds ?? 0);
    } else {
      this._beginAction();
    }
  }

  /** Пауза/продолжение отсчёта действия (время замирает, прогресс сохраняется). */
  protected togglePause(): void {
    this.paused.update((p) => !p);
  }

  /**
   * Сколько секунд засчитать. `binary` (микро-победа) — вся длительность (число не важно).
   * `duration` (привычка) — фактически прошедшие секунды действия (частичный зачёт при досрочной
   * остановке; на нуле = вся длительность).
   */
  private _performed(): number {
    if (this.data.mode === 'binary') {
      return this._actionSeconds();
    }
    return Math.max(0, this._actionSeconds() - Math.max(0, this.remaining()));
  }

  /** Досрочно: `binary` — засчитать полностью; `duration` — засчитать фактически пройденное. */
  protected finishEarly(): void {
    this._stop();
    this._ref.close({ status: 'done', performedSeconds: this._performed(), fromRestart: this._fromRestart });
  }

  /** Подтвердил выполнение на нуле — засчитываем полную длительность действия. */
  protected confirmDone(): void {
    this._ref.close({ status: 'done', performedSeconds: this._performed(), fromRestart: this._fromRestart });
  }

  /** Отмена/«не сейчас» — без записи. */
  protected cancel(): void {
    this._stop();
    this._ref.close({ status: 'cancel' });
  }

  /** Переключает звук и запоминает выбор. */
  protected toggleSound(): void {
    const next = !this.soundOn();
    this.soundOn.set(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? '1' : '0');
    } catch {
      /* localStorage недоступен — не критично */
    }
  }

  /** Останавливает интервал. */
  private _stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /** Читает сохранённый выбор звука (по умолчанию вкл). */
  private _readSound(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  }

  // Ноты (Гц): мажорная гамма для торжественных арпеджио.
  private static readonly C5 = 523.25;
  private static readonly E5 = 659.25;
  private static readonly G5 = 783.99;
  private static readonly C6 = 1046.5;
  private static readonly E6 = 1318.51;

  /** Сигнал «финиш» — победная фанфара «да-да-да-да-ДАМ»: восходящий бег + мощный держащийся аккорд. */
  private _chime(): void {
    const T = AccentTimerModalComponent;
    this._tones([
      { freq: T.C5, start: 0.0, dur: 0.16, gain: 0.95 }, // да
      { freq: T.E5, start: 0.14, dur: 0.16, gain: 0.95 }, // да
      { freq: T.G5, start: 0.28, dur: 0.16, gain: 0.97 }, // да
      { freq: T.C6, start: 0.42, dur: 0.16, gain: 1.0 }, // да
      { freq: T.E6, start: 0.58, dur: 1.1, gain: 0.9 }, // ДАМ! (верх, держится)
      { freq: T.C6, start: 0.58, dur: 1.1, gain: 0.6 }, // полнота аккорда
    ]);
  }

  /** Сигнал «старт» — короткое бодрое «та-ДАМ» (подготовка кончилась, начинай). */
  private _startChime(): void {
    const T = AccentTimerModalComponent;
    this._tones([
      { freq: T.G5, start: 0.0, dur: 0.13, gain: 0.9 }, // та
      { freq: T.C6, start: 0.12, dur: 0.65, gain: 1.0 }, // ДАМ (держится)
    ]);
  }

  /**
   * Проигрывает набор нот через Web Audio (без аудио-файла) колокольным тембром: основная синус-нота
   * + тихая октавная гармоника + мягкая bell-огибающая (быстрая атака, плавный спад). Выход — на
   * полную шкалу (громкость = системная громкость устройства, не приглушаем своим гейном); лимитер
   * (компрессор) ловит наложения аккорда, чтобы было громко, но без хрипа.
   */
  private _tones(notes: readonly { freq: number; start: number; dur: number; gain: number }[]): void {
    try {
      // Переиспользуем персистентный, «разбуженный» жестом контекст (iOS не даёт играть свежесозданный
      // вне жеста). Если по какой-то причине завис в suspended — пробуем добудить (на десктопе сработает).
      const ctx = this._ensureAudioCtx();
      if (ctx === null) {
        return;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      // Лимитер: позволяет гнать ноты на полную шкалу (ride системной громкости) без клиппинга.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      const master = ctx.createGain();
      master.gain.value = 1.0;
      master.connect(limiter).connect(ctx.destination);
      // Нота = фундамент + 2-я и 3-я гармоники (плотный спектр) с сустейном (держим, не роняем
      // сразу) → высокий RMS → воспринимается громко, как музыка/видео, а не тонкий «пик».
      const partials: readonly (readonly [number, number])[] = [
        [1, 1.0],
        [2, 0.5],
        [3, 0.28],
      ];
      const voice = (freq: number, at: number, dur: number, peak: number): void => {
        const t0 = ctx.currentTime + at;
        const rel = Math.min(0.1, dur * 0.4);
        const sustainEnd = Math.max(t0 + 0.02, t0 + dur - rel);
        for (const [mult, rel0] of partials) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq * mult;
          const pk = peak * rel0;
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(pk, t0 + 0.008); // атака
          gain.gain.setValueAtTime(pk, sustainEnd); // сустейн-плато
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // релиз
          osc.connect(gain).connect(master);
          osc.start(t0);
          osc.stop(t0 + dur);
        }
      };
      for (const n of notes) {
        voice(n.freq, n.start, n.dur, n.gain);
      }
    } catch {
      /* звук не критичен */
    }
  }
}
