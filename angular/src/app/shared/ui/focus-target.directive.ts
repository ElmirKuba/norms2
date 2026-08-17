import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/** Сколько держится подсветка, мс. Столько же живёт анимация в `_focus-target.scss`. */
const HIGHLIGHT_MS = 2400;

/**
 * «Куда ты перешёл» — подсветка цели перехода (концепт Elmir, 2.9·20).
 *
 * Ссылка-источник несёт `?focus=<id>`; элемент-цель помечен `[appFocusTarget]="<id>"`. Совпало —
 * элемент подтягивается в поле зрения и **коротко пульсирует**, потом гаснет сам.
 *
 * **Зачем.** Переход по ссылке из дашборда или статистики выбрасывал человека в общий список, где
 * он заново искал глазами то, ради чего кликнул: «Открыть» вело в чеклист из восемнадцати строк,
 * строка достижения — в сетку из пяти карточек. Внимание, которое экран сам же и направил, тут же
 * терялось.
 *
 * **Правила, важные для поведения:**
 * - подсветка **временная**: это метка «вот оно», а не выделение состояния. Осталась бы висеть —
 *   стала бы вторым видом «активного» элемента и начала врать;
 * - `?focus` **вычищается из URL** сразу (`replaceUrl`), иначе он застрянет в истории и подсветка
 *   повторится на «назад» — уже без причины;
 * - при `prefers-reduced-motion` пульсации нет: остаётся статичная рамка на то же время, и
 *   прокрутка мгновенная вместо плавной.
 *
 * Одна директива на все экраны: копия логики по месту разъехалась бы, как разъехался отступ
 * раздела (он до сих пор дублируется в семи компонентах).
 */
@Directive({ selector: '[appFocusTarget]' })
export class FocusTargetDirective implements AfterViewInit, OnDestroy {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  /** Идентификатор элемента: сравнивается со значением `?focus=`. */
  public readonly focusTarget = input.required<string>({ alias: 'appFocusTarget' });

  private _timer: number | null = null;

  public ngAfterViewInit(): void {
    const wanted = this._route.snapshot.queryParamMap.get('focus');
    if (wanted === null || wanted !== this.focusTarget()) {
      return;
    }

    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const element = this._host.nativeElement;

    // Класс вешаем сразу, а прокрутку откладываем на следующий кадр: на момент ngAfterViewInit
    // соседние блоки экрана могут ещё достраиваться, и позиция элемента успеет уехать.
    //
    // Раньше в кадр был убран и класс — и подсветка целиком зависела от того, рисует ли браузер
    // кадры вообще. В фоновой или невидимой вкладке `requestAnimationFrame` не вызывается: URL
    // при этом чистился (он вне кадра), и переход молча оставался без метки. Метка — не анимация,
    // ей кадры ни к чему.
    element.classList.add(reduced ? 'is-focus-target-static' : 'is-focus-target');
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });

    this._timer = window.setTimeout(() => {
      element.classList.remove('is-focus-target', 'is-focus-target-static');
    }, HIGHLIGHT_MS);

    // Параметр своё дело сделал — убираем его из адреса, не плодя запись в истории.
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { focus: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public ngOnDestroy(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
    }
  }
}
