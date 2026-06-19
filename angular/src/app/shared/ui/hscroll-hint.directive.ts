import { AfterViewInit, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Подсказка-нудж горизонтального скролла. Вешать на горизонтальный scroll-контейнер
 * (`overflow-x: auto`, обычно со скрытой полосой). При появлении, если контент не влезает
 * по ширине, элемент сам чуть прокручивается вправо и возвращается — явный намёк, что его
 * можно крутить вбок. Без одноразовости (реш. Elmir: помогает каждый заход).
 *
 * Делает две проверки: сразу (статичный контент — напр. табы) и через ~0.7с (контент,
 * подгружаемый асинхронно — напр. кнопки, зависящие от ответа API). Нудж — один раз за
 * монтирование.
 */
@Directive({ selector: '[appHscrollHint]' })
export class HscrollHintDirective implements AfterViewInit {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private _nudged = false;

  /** Доп. задержка нуджа (мс) — чтобы развести по времени несколько рядов на экране. */
  public readonly hintDelay = input(0, { alias: 'appHscrollHintDelay' });

  public ngAfterViewInit(): void {
    this._check();
    window.setTimeout(() => this._check(), 700);
  }

  /** Если контент переполняет по ширине и ещё не подсказывали — проигрывает нудж. */
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
    const amount = Math.min(80, overflow);
    const delay = this.hintDelay();
    // Вправо (контент уезжает справа-налево, открывая скрытое) → обратно. delay разводит
    // несколько рядов по времени (напр. меню раздела раньше, кнопки чуть позже).
    window.setTimeout(() => el.scrollTo({ left: amount, behavior: 'smooth' }), 450 + delay);
    window.setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 1150 + delay);
  }
}
