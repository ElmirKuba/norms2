import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Инлайн-спиннер (загрузка участка UI). */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="spinner" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true"></span>`,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .spinner {
        border-radius: 50%;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-accent);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SpinnerComponent {
  /** Размер в пикселях. */
  public readonly size = input(24);
}
