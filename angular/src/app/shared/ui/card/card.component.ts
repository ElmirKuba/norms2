import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Карточка-поверхность (контейнер контента). */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: [
    `
      :host {
        display: block;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        box-shadow: var(--shadow-1);
      }
    `,
  ],
})
export class CardComponent {}
