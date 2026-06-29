import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/** Данные таймера: что и на сколько. */
export interface MicroWinTimerData {
  /** Название действия (заголовок фокус-экрана). */
  title: string;
  /** Длительность в секундах (> 0). */
  durationSeconds: number;
}

/** Результат: `done` — засчитать выполнение, иначе `null`/`cancel` — без записи. */
export type MicroWinTimerResult = 'done' | 'cancel';

const SOUND_KEY = 'accent.microWinTimer.sound';

/**
 * Фокус-модалка таймера микро-победы (M#B3-4): крупный обратный отсчёт на спокойном экране —
 * превращает телефон в одну считающую поверхность вместо ленты (anti-doomscroll,
 * [[accent-core-why-anti-doomscroll]]). На нуле — мягкий звук (опц., по умолч. вкл) и вопрос
 * «Сделал?»: засчитываем по подтверждению, не автоматом. Бэк не нужен — завершение делает
 * вызывающий через существующий `completeMicroWin`. Тексты просто ([[ui-copy-plain-simple]]).
 */
@Component({
  selector: 'app-micro-win-timer-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tm" [class.tm--ask]="phase() === 'ask'">
      <button type="button" class="tm__sound" [attr.aria-label]="soundOn() ? 'Звук включён' : 'Звук выключен'"
        (click)="toggleSound()">{{ soundOn() ? '🔔' : '🔕' }}</button>

      <h2 class="tm__title">{{ data.title }}</h2>

      @if (phase() === 'running') {
        <div class="tm__clock" role="timer" [attr.aria-label]="'Осталось ' + clock()">{{ clock() }}</div>
        <div class="tm__bar"><span class="tm__bar-fill" [style.width.%]="progress()"></span></div>
        <div class="tm__foot">
          <app-button (click)="finishEarly()">Готово раньше</app-button>
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
    `,
  ],
})
export class MicroWinTimerModalComponent implements OnDestroy {
  private readonly _ref =
    inject<MatDialogRef<MicroWinTimerModalComponent, MicroWinTimerResult | null>>(MatDialogRef);
  /** Данные таймера. */
  protected readonly data = inject<MicroWinTimerData>(MAT_DIALOG_DATA);

  /** Оставшиеся секунды. */
  protected readonly remaining = signal(this.data.durationSeconds);
  /** Фаза: идёт отсчёт или спрашиваем «Сделал?». */
  protected readonly phase = signal<'running' | 'ask'>('running');
  /** Звук на нуле (по умолчанию вкл; запоминается в localStorage). */
  protected readonly soundOn = signal(this._readSound());

  /** Отсчёт в формате m:ss. */
  protected readonly clock = computed(() => {
    const s = Math.max(0, this.remaining());
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  /** Доля пройденного времени (для полосы). */
  protected readonly progress = computed(() => {
    const total = this.data.durationSeconds;
    return total > 0 ? ((total - this.remaining()) / total) * 100 : 100;
  });

  private _intervalId: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  public ngOnDestroy(): void {
    this._stop();
  }

  /** Тик раз в секунду: уменьшает остаток; на нуле — переход в «Сделал?» + звук. */
  private _tick(): void {
    const next = this.remaining() - 1;
    this.remaining.set(next);
    if (next <= 0) {
      this._stop();
      this.remaining.set(0);
      this.phase.set('ask');
      if (this.soundOn()) {
        this._chime();
      }
    }
  }

  /** Закончил раньше срока — выполнил → засчитываем. */
  protected finishEarly(): void {
    this._stop();
    this._ref.close('done');
  }

  /** Подтвердил выполнение на нуле — засчитываем. */
  protected confirmDone(): void {
    this._ref.close('done');
  }

  /** Отмена/«не сейчас» — без записи. */
  protected cancel(): void {
    this._stop();
    this._ref.close('cancel');
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

  /** Мягкий двухнотный сигнал через Web Audio (без аудио-файла). */
  private _chime(): void {
    try {
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx === undefined) {
        return;
      }
      const ctx = new Ctx();
      const play = (freq: number, start: number, dur: number): void => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      play(660, 0, 0.35);
      play(880, 0.18, 0.4);
      setTimeout(() => void ctx.close(), 900);
    } catch {
      /* звук не критичен */
    }
  }
}
