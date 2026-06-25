import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../shared/ui/button/button.component';

/** Данные мини-гида поля: заголовок + абзацы простого пояснения «что/зачем». */
export interface FieldGuideData {
  /** Заголовок модалки (что объясняем). */
  title: string;
  /** Абзацы пояснения (каждый — отдельная строка). */
  paragraphs: string[];
}

/**
 * Универсальная мини-модалка «что это?» по одному полю формы (MatDialog, ADR-0026).
 * Лёгкий контекстный гид (заголовок + пара абзацев) — открывается рядом с полем, не
 * теряя ввод (вложенный диалог). Заменяет «простыню» одной большой справки: объясняем
 * точечно то, на что навёл пользователь. Общая для Акцента (микро-победы/привычки/цели).
 * Тексты — просто, по-человечески ([[ui-copy-plain-simple]]).
 */
@Component({
  selector: 'app-field-guide-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head"><h2>{{ data.title }}</h2></div>
      <div class="dlg__body">
        @for (p of data.paragraphs; track $index) {
          <p class="fg__p">{{ p }}</p>
        }
      </div>
      <div class="dlg__foot">
        <app-button (click)="close()">Понятно</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .fg__p {
        margin: 0 0 var(--space-3);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .fg__p:last-child {
        margin-bottom: 0;
      }
    `,
  ],
})
export class FieldGuideModalComponent {
  private readonly _ref = inject<MatDialogRef<FieldGuideModalComponent>>(MatDialogRef);
  /** Заголовок + абзацы гида. */
  protected readonly data = inject<FieldGuideData>(MAT_DIALOG_DATA);

  /** Закрывает модалку. */
  protected close(): void {
    this._ref.close();
  }
}
