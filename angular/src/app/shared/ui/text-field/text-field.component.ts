import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { FormControl } from '@angular/forms';

/** Счётчик для уникальных id (связка input↔error через aria-describedby). */
let nextId = 0;

/**
 * Поле формы: лейбл + input + ошибка. Для `type='password'` — одно поле + тумблер
 * «показать/скрыть» (без поля «повторите», UX-практика). Требования/ошибки — рядом
 * с полем; `aria-invalid`/`aria-describedby` для a11y. Работает с реактивным
 * `FormControl` (передаётся явным input'ом — без CVA-бойлерплейта).
 */
@Component({
  selector: 'app-text-field',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
})
export class TextFieldComponent {
  /** Подпись поля. */
  public readonly label = input('');
  /** Реактивный контрол. */
  public readonly control = input.required<FormControl<string>>();
  /** Тип поля. */
  public readonly type = input<'text' | 'password' | 'email'>('text');
  /** autocomplete (опц.). */
  public readonly autocomplete = input<string>();
  /** placeholder (опц.). */
  public readonly placeholder = input<string>();
  /** Подсказка под полем (опц.; скрывается при ошибке). */
  public readonly hint = input<string>();
  /** Текст ошибки (опц.; считает родитель по `error.code`/валидаторам). */
  public readonly error = input<string | null>(null);
  /** Обязательное поле (визуальная метка). */
  public readonly required = input(false);

  /** Показывать ли пароль открытым. */
  protected readonly reveal = signal(false);
  /** Уникальный id для aria-describedby. */
  protected readonly describedById = `tf-${String(nextId++)}`;

  /** Эффективный тип input (password + reveal → text). */
  protected readonly effectiveType = computed(() =>
    this.type() === 'password' && this.reveal() ? 'text' : this.type(),
  );

  /** Переключает видимость пароля. */
  protected toggleReveal(): void {
    this.reveal.update((value) => !value);
  }
}
