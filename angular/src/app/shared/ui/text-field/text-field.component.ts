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
  template: `
    <label class="field">
      @if (label()) {
        <span class="label">{{ label() }}@if (required()) {<span class="req" aria-hidden="true"> *</span>}</span>
      }
      <span class="control">
        <input
          [type]="effectiveType()"
          [formControl]="control()"
          [attr.autocomplete]="autocomplete() ?? null"
          [attr.placeholder]="placeholder() ?? null"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? describedById : null"
        />
        @if (type() === 'password') {
          <button
            type="button"
            class="reveal"
            (click)="toggleReveal()"
            [attr.aria-pressed]="reveal()"
            aria-label="Показать или скрыть пароль"
          >
            {{ reveal() ? '🙈' : '👁' }}
          </button>
        }
      </span>
      @if (hint() && !error()) {
        <span class="hint">{{ hint() }}</span>
      }
      @if (error()) {
        <span class="error" [id]="describedById">{{ error() }}</span>
      }
    </label>
  `,
  styles: [
    `
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .req {
        color: var(--color-danger);
      }
      .control {
        position: relative;
        display: flex;
        align-items: center;
      }
      input {
        width: 100%;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);

        &:focus {
          border-color: var(--color-accent);
        }
      }
      .reveal {
        position: absolute;
        right: var(--space-2);
        min-width: 32px;
        min-height: 32px;
        color: var(--color-text-muted);
      }
      .hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .error {
        font-size: var(--fs-xs);
        color: var(--color-danger);
      }
    `,
  ],
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
