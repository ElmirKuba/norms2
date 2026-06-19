import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

/**
 * Подсказка-нудж горизонтального скролла. Вешать на горизонтальный scroll-контейнер
 * (`overflow-x: auto`, обычно со скрытой полосой). Когда ряд **попадает в поле зрения**
 * (IntersectionObserver) и контент не влезает по ширине — элемент сам чуть прокручивается
 * вправо и возвращается: явный намёк, что его можно крутить вбок.
 *
 * Запуск по видимости (а не по монтированию) важен: ряд может быть глубоко внизу (напр.
 * чипсы в модалке, да ещё под мобильной клавиатурой) — нудж должен сыграть, когда человек
 * до него доскроллил, а не «где-то там» при открытии. Нудж — один раз. Без одноразовости
 * между заходами (реш. Elmir: помогает каждый раз). `appHscrollHintDelay` (мс) разводит
 * несколько рядов по времени.
 */
@Directive({ selector: '[appHscrollHint]' })
export class HscrollHintDirective implements AfterViewInit, OnDestroy {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Доп. задержка нуджа (мс) — чтобы развести по времени несколько рядов на экране. */
  public readonly hintDelay = input(0, { alias: 'appHscrollHintDelay' });

  private _nudged = false;
  private _io: IntersectionObserver | null = null;
  private readonly _timers: number[] = [];

  public ngAfterViewInit(): void {
    // Нет IntersectionObserver (старое окружение) — деградируем к проверке по таймеру.
    if (typeof IntersectionObserver === 'undefined') {
      this._scheduleCheck();
      return;
    }
    this._io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this._nudged) {
            this._scheduleCheck();
          }
        }
      },
      { threshold: 0.6 },
    );
    this._io.observe(this._host.nativeElement);
  }

  public ngOnDestroy(): void {
    this._io?.disconnect();
    this._timers.forEach((t) => window.clearTimeout(t));
  }

  /** Проверяет переполнение сейчас и через ~0.7с (контент мог подгрузиться асинхронно). */
  private _scheduleCheck(): void {
    this._check();
    this._timers.push(window.setTimeout(() => this._check(), 700));
  }

  /** Если контент переполняет по ширине и ещё не подсказывали — проигрывает нудж (один раз). */
  private _check(): void {
    if (this._nudged) {
      return;
    }
    const el = this._host.nativeElement;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow < 12) {
      return; // всё влезает — крутить нечего
    }
    this._nudged = true;
    this._io?.disconnect();
    const amount = Math.min(80, overflow);
    const delay = this.hintDelay();
    // Вправо (контент уезжает справа-налево, открывая скрытое) → обратно.
    this._timers.push(
      window.setTimeout(() => el.scrollTo({ left: amount, behavior: 'smooth' }), 450 + delay),
    );
    this._timers.push(
      window.setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 1150 + delay),
    );
  }
}
