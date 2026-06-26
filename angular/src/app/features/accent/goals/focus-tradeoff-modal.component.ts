import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/** Данные модалки: название цели, ради фокуса которой просим «ради чего откажусь». */
export interface FocusTradeoffData {
  /** Название цели (для ясности, какую именно описываем). */
  goalTitle: string;
}

/**
 * Мини-модалка «ради чего откажусь» при попытке взять накопительную цель в фокус без
 * заполненного `tradeoff` (mission-filter, ADR-0053). Вместо тупиковой ошибки — одно поле +
 * дружеское «зачем» + ясно, для какой цели. Закрывается с введённой строкой (→ сохранить и
 * взять в фокус) или `null` (отмена). Тексты — просто, по-человечески ([[ui-copy-plain-simple]]).
 */
@Component({
  selector: 'app-focus-tradeoff-modal',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head"><h2>В фокус — но осознанно</h2></div>
      <div class="dlg__body ft">
        <p class="ft__lead">
          Фокус в «Акценте» — это выбор главного <strong>через отказ от лишнего</strong>, а не «ещё одна
          цель в кучу». Чтобы взять «{{ data.goalTitle }}» в фокус, назови, ради чего ты готов
          <strong>отложить остальное</strong> — это и делает цель настоящим приоритетом.
        </p>
        <label class="ft__field">
          <span class="ft__label">Ради чего откажусь</span>
          <input class="ft__input" type="text" maxlength="280" [formControl]="control"
            placeholder="Например: меньше сериалов вечером" (keydown.enter)="save()" autofocus />
        </label>
      </div>
      <div class="dlg__foot">
        <app-button variant="ghost" (click)="cancel()">Не сейчас</app-button>
        <app-button [disabled]="control.value.trim() === ''" (click)="save()">В фокус</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .ft {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .ft__lead {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        line-height: 1.5;
      }
      .ft__lead strong {
        color: var(--color-text);
      }
      .ft__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .ft__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ft__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
      }
      .ft__input:focus {
        border-color: var(--color-accent);
      }
    `,
  ],
})
export class FocusTradeoffModalComponent {
  private readonly _ref = inject<MatDialogRef<FocusTradeoffModalComponent, string | null>>(MatDialogRef);
  /** Данные (название цели). */
  protected readonly data = inject<FocusTradeoffData>(MAT_DIALOG_DATA);
  /** Поле «ради чего откажусь». */
  protected readonly control = new FormControl('', { nonNullable: true });
  /** Идёт ли что-то (резерв). */
  protected readonly busy = signal(false);

  /** Сохраняет — закрывает с введённой строкой (если не пусто). */
  protected save(): void {
    const value = this.control.value.trim();
    if (value === '') {
      return;
    }
    this._ref.close(value);
  }

  /** Отмена — закрывает с null. */
  protected cancel(): void {
    this._ref.close(null);
  }
}
