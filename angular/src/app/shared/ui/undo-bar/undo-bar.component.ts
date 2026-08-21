import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Полоса отмены внизу экрана: «<что произошло> · Отменить».
 *
 * **Зачем она есть.** Диалог-подтверждение спрашивает разрешение до действия и стоит человеку
 * лишнего клика **на каждом** шаге — даже когда ошибиться не страшно. Полоса отмены переворачивает
 * обмен: действие происходит сразу, а цена ошибки — один клик **после**, и только если ошибка
 * случилась. Подтверждение остаётся там, где отменить нельзя (уходит поддерево).
 *
 * Компонент презентационный: он не знает, что отменяет, и не считает время сам — таймер живёт
 * в сторе экрана, потому что там же лежит и отложенный запрос, который этот таймер отменяет.
 */
@Component({
  selector: 'app-undo-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="undo" role="status">
      <span class="undo__text">{{ text() }}</span>
      <button type="button" class="undo__btn" (click)="undo.emit()">Отменить</button>
    </div>
  `,
  styles: [
    `
      /* Фиксировано внизу и по центру: полоса должна быть видна независимо от того, куда
         прокручен длинный список, — иначе отмена доступна только тому, кто не уехал вниз. */
      .undo {
        position: fixed;
        bottom: var(--space-4);
        left: 50%;
        z-index: 20;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
        transform: translateX(-50%);
        animation: undo-in 160ms ease-out;
      }

      .undo__text {
        color: var(--color-text);
        font-size: var(--fs-sm);
      }

      .undo__btn {
        min-height: var(--touch-min);
        padding: 0 var(--space-2);
        border: none;
        background: none;
        color: var(--color-accent);
        font-size: var(--fs-sm);
        font-weight: 600;
        cursor: pointer;
      }

      .undo__btn:hover {
        text-decoration: underline;
      }

      @keyframes undo-in {
        from {
          opacity: 0;
          transform: translate(-50%, 8px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      }

      /* Уважаем системную настройку: всплывание — украшение, а не смысл. */
      @media (prefers-reduced-motion: reduce) {
        .undo {
          animation: none;
        }
      }
    `,
  ],
})
export class UndoBarComponent {
  /** Что произошло — короткой фразой в прошедшем времени («Удалено», «В архиве»). */
  public readonly text = input.required<string>();
  /** Нажали «Отменить». */
  public readonly undo = output<void>();
}
