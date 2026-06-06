import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Пустое состояние с характером («тут пока пусто — пригласи своих»). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  /** Заголовок. */
  public readonly title = input('');
  /** Подпись (опц.). */
  public readonly text = input<string>();
}
