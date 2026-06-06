import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Баннер-сообщение (info/success/warning/danger) — напоминания, подсказки. */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
})
export class BannerComponent {
  /** Тон баннера. */
  public readonly tone = input<'info' | 'success' | 'warning' | 'danger'>('info');
}
