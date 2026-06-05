import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Пустое состояние с характером («тут пока пусто — пригласи своих»). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="title">{{ title() }}</div>
    @if (text()) {
      <div class="text">{{ text() }}</div>
    }
    <ng-content />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        text-align: center;
        padding: var(--space-8) var(--space-4);
        color: var(--color-text-muted);
      }
      .title {
        font-weight: var(--fw-medium);
        color: var(--color-text);
      }
      .text {
        font-size: var(--fs-sm);
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Заголовок. */
  public readonly title = input('');
  /** Подпись (опц.). */
  public readonly text = input<string>();
}
