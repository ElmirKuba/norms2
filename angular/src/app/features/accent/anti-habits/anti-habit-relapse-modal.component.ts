import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import type { RelapsePayload } from '../accent.types';

/**
 * Модалка отметки срыва (MatDialog). Тон **non-punitive** (ADR-0049): срыв — это данные, а не
 * приговор; серия начнётся заново, но рекорд останется. Опц. триггер/заметка — для рефлексии
 * (свободные поля → «без ПДн», ui-ux §9). Закрывается с `RelapsePayload` (подтвердить) или
 * `null` (отмена). Сам вызов API — на вызывающей детали (нужно обновить счётчик+историю).
 */
@Component({
  selector: 'app-anti-habit-relapse-modal',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>Новая попытка</h2>
      </div>

      <form class="dlg__form" [formGroup]="form" (ngSubmit)="confirm()">
        <div class="dlg__body arm__form">
          <p class="arm__lead">
            Срыв — это данные, а не приговор. Счётчик начнётся заново, но <strong>рекорд
            останется с тобой</strong>. Если хочешь — отметь, что стало триггером: это поможет
            в следующий раз.
          </p>

          <label class="arm__field">
            <span class="arm__label">Триггер <span class="arm__opt">(необязательно)</span></span>
            <input
              class="arm__input"
              type="text"
              maxlength="120"
              formControlName="triggerTag"
              placeholder="напр. стресс, скука, компания"
            />
          </label>

          <label class="arm__field">
            <span class="arm__label">Заметка <span class="arm__opt">(необязательно)</span></span>
            <textarea
              class="arm__input arm__area"
              rows="2"
              maxlength="2000"
              formControlName="note"
              placeholder="Что произошло, что поможет дальше"
            ></textarea>
            <span class="arm__hint">Без реальных имён, телефонов и адресов.</span>
          </label>
        </div>

        <div class="dlg__foot">
          <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
          <app-button type="submit">Начать заново</app-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .arm__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .arm__lead {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .arm__lead strong {
        color: var(--color-text);
      }
      .arm__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .arm__label {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .arm__opt {
        font-size: var(--fs-xs);
      }
      .arm__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
      }
      .arm__area {
        resize: vertical;
        min-height: 3rem;
      }
      .arm__input:focus {
        border-color: var(--color-accent);
      }
      .arm__hint {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AntiHabitRelapseModalComponent {
  private readonly _ref =
    inject<MatDialogRef<AntiHabitRelapseModalComponent, RelapsePayload | null>>(MatDialogRef);

  /** Форма триггера/заметки (оба опциональны). */
  protected readonly form = new FormGroup({
    triggerTag: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  /** Подтвердить срыв — собрать payload и закрыть. */
  protected confirm(): void {
    const v = this.form.getRawValue();
    const triggerTag = v.triggerTag.trim();
    const note = v.note.trim();
    this._ref.close({
      triggerTag: triggerTag.length > 0 ? triggerTag : null,
      note: note.length > 0 ? note : null,
    });
  }

  /** Отмена — закрыть без результата. */
  protected cancel(): void {
    this._ref.close(null);
  }
}
