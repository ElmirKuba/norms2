import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Лёгкая кнопка на глобальных `.btn`-стилях (accent/ghost/danger, loading, block). */
@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  /** Визуальный вариант. */
  public readonly variant = input<'accent' | 'ghost' | 'danger'>('accent');
  /** Тип нативной кнопки. */
  public readonly type = input<'button' | 'submit'>('button');
  /** Заблокирована. */
  public readonly disabled = input(false);
  /** Состояние загрузки (спиннер + блок). */
  public readonly loading = input(false);
  /** На всю ширину. */
  public readonly block = input(false);
  /** Доступное имя (для icon-кнопок без видимого текста); null — не задавать. */
  public readonly ariaLabel = input<string | null>(null);
}
