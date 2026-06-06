import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Инлайн-спиннер (загрузка участка UI). */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss',
})
export class SpinnerComponent {
  /** Размер в пикселях. */
  public readonly size = input(24);
}
