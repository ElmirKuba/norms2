import { ChangeDetectionStrategy, Component, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import type { AfterViewInit } from '@angular/core';
import { DestroyRef } from '@angular/core';
import { Release200SectionsComponent } from './release-2-0-0-sections.component';

/** Ширина макета экрана-«скриншота» внутри слайда — по ней считается масштаб. */
const SHOT_WIDTH = 1280;

/** Сколько прокрутки блока презентации держится первый и последний слайд (доля). */
const SLIDE_HOLD = 0.07;

/**
 * Лендинг обновления — пример ноты формата `page` (2.9.2·4).
 *
 * Страница подставляется в `/releases/:key` вместо мини-рендера markdown: её находит реестр
 * [`release-pages.registry.ts`](../../release-pages.registry.ts) по ключу ноты. В колокольчике
 * такая нота открывается новой вкладкой — в модалке 720px страница с прокруткой разваливается.
 *
 * **Механика перенесена из полигона** (`~/coding/landing-lab/5`) и держится на трёх правилах:
 *
 * 1. **Движение считает JS, а не CSS-таймлайны.** `animation-timeline` поддерживается не везде, а
 *    `fill-mode: both` с неподдержанным таймлайном застывает в КОНЕЧНОМ кадре: блоки уезжают за
 *    край, а страница выглядит сломанной. Прогресс секции считается на `scroll` и кладётся в
 *    CSS-переменную — работает везде и проверяемо.
 * 2. **Питомцы едут под содержимым** (`z-index: -1`) и по свободной полосе справа. Развести
 *    слоями мало: светлый силуэт поверх крупных светлых цифр читается как каша, даже находясь
 *    позади. Разводить надо и по площади.
 * 3. **`prefers-reduced-motion` — отдельная ветка**, а не «выключить анимацию»: страница обязана
 *    читаться целиком без единого движения.
 */
@Component({
  selector: 'app-release-2-0-0-page',
  imports: [Release200SectionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Правила лежат под `.release-landing`, поэтому глобально ничего не течёт.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './release-2-0-0.page.html',
  styleUrl: './release-2-0-0.page.scss',
})
export class Release200Page implements AfterViewInit {
  private readonly _host = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * Запускает механику после отрисовки.
   *
   * `ngAfterViewInit`, а не `afterNextRender`: страница создаётся динамически через
   * `ngComponentOutlet`, и полагаться на фазы первого рендера приложения тут нельзя — коты
   * стояли на месте именно поэтому.
   */
  public ngAfterViewInit(): void {
    this._start();
  }

  /** Подписывается на прокрутку и раскладывает движение по секциям. */
  private _start(): void {
    const root = this._host.nativeElement as HTMLElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pets = [...root.querySelectorAll<HTMLElement>('.pet')].map((el) => ({
      el,
      box: el.closest('section'),
    }));
    const deck = root.querySelector<HTMLElement>('.deck');
    const slides = deck === null ? [] : [...deck.querySelectorAll<HTMLElement>('.dslide')];
    const shots = [...root.querySelectorAll<HTMLElement>('.shot-live')];

    // Появление блоков: без движения показываем сразу, иначе — по мере въезда в экран.
    const rises = [...root.querySelectorAll<HTMLElement>('.rise')];
    if (reduce) {
      rises.forEach((el) => el.classList.add('is-in'));
    } else {
      (root.querySelector('.release-landing') ?? root).classList.add('js');
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              io.unobserve(entry.target);
            }
          }),
        { threshold: 0.15 },
      );
      rises.forEach((el) => io.observe(el));
      this._destroyRef.onDestroy(() => io.disconnect());
    }

    let shown = -1;
    const paint = (): void => {
      const vh = innerHeight;

      for (const { el, box } of pets) {
        if (box === null) {
          continue;
        }
        const rect = box.getBoundingClientRect();
        const progress = (vh - rect.top) / (vh + rect.height);
        el.style.setProperty('--p', Math.max(0, Math.min(1, progress)).toFixed(4));
      }

      // Макет экрана нарисован в фиксированной ширине — вписываем его масштабом в колонку.
      shots.forEach((el) => el.style.setProperty('--k', String(el.clientWidth / SHOT_WIDTH)));

      if (deck !== null && slides.length > 0) {
        const rect = deck.getBoundingClientRect();
        const total = rect.height - vh;
        const progress = Math.max(0, Math.min(1, -rect.top / total));
        // Запас с обоих концов: без него первый слайд проскакивает, едва блок прилип, а
        // последний уходит раньше, чем секция отпускает экран.
        const eased = Math.max(0, Math.min(1, (progress - SLIDE_HOLD) / (1 - SLIDE_HOLD * 2)));
        const index = Math.min(slides.length - 1, Math.floor(eased * slides.length));
        if (index !== shown) {
          slides.forEach((el, n) => {
            el.classList.toggle('is-active', n === index);
            el.classList.toggle('is-past', n < index);
            el.classList.toggle('is-on', Math.abs(n - index) <= 1);
          });
          shown = index;
        }
      }
    };

    let ticking = false;
    const onScroll = (): void => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(() => {
        paint();
        ticking = false;
      });
    };

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    // Первые расчёты — следующими кадрами: до отрисовки у секций нет размеров, и прогресс
    // вышел бы нулевым, а коты стояли бы на месте.
    requestAnimationFrame(paint);
    setTimeout(paint, 120);
    this._destroyRef.onDestroy(() => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    });
    paint();
  }
}
