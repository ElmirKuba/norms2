import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../shared/ui/button/button.component';

/** Пункт маркированного списка в гиде: жирный термин + пояснение. */
export interface FieldGuideBullet {
  /** Термин (жирный). */
  term: string;
  /** Пояснение к термину. */
  desc: string;
}

/** Данные мини-гида поля: заголовок + абзацы и/или маркированный список (перечисления). */
export interface FieldGuideData {
  /** Заголовок модалки (что объясняем). */
  title: string;
  /** Абзацы пояснения (вступление до списка). */
  paragraphs?: string[];
  /** Маркированный список (перечисления вроде родов цели / типов привычки). */
  bullets?: FieldGuideBullet[];
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
        @for (p of data.paragraphs ?? []; track $index) {
          <p class="fg__p">{{ p }}</p>
        }
        @if (data.bullets; as bullets) {
          <ul class="fg__list">
            @for (b of bullets; track b.term) {
              <li><b>{{ b.term }}</b> — {{ b.desc }}</li>
            }
          </ul>
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
      .fg__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .fg__list li {
        position: relative;
        padding-left: var(--space-4);
      }
      .fg__list li::before {
        content: '•';
        position: absolute;
        left: var(--space-1);
        color: var(--color-accent);
      }
      .fg__list b {
        color: var(--color-text);
        font-weight: var(--fw-medium);
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
