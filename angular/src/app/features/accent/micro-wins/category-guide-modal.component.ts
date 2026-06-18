import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { MICRO_WIN_CATEGORY_DESCRIPTIONS, MICRO_WIN_CATEGORY_LABELS } from '../accent.types';
import type { MicroWinCategory } from '../accent.types';

/**
 * Модалка-гид по категориям микро-побед (MatDialog, ADR-0026). Объясняет «что/зачем»
 * по каждой из 11 категорий. Открывается со страницы микро-побед и из формы создания/
 * редактирования (вложенный диалог поверх формы) — почитать, не теряя ввод.
 */
@Component({
  selector: 'app-category-guide-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cg">
      <h2 class="cg__title">Что значат категории</h2>
      <p class="cg__lead">
        Лёгкая линза «какого типа действие». Микро-победы — для тяжёлых дней: сделай хоть одно.
      </p>
      <ul class="cg__list">
        @for (c of categories; track c.label) {
          <li><b>{{ c.label }}</b> — {{ c.description }}</li>
        }
      </ul>
      <div class="cg__actions">
        <app-button (click)="close()">Закрыть</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .cg__title {
        margin: 0 0 var(--space-2);
      }
      .cg__lead {
        margin: 0 0 var(--space-4);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .cg__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .cg__list b {
        color: var(--color-text);
        font-weight: var(--fw-medium);
      }
      .cg__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--space-5);
      }
    `,
  ],
})
export class CategoryGuideModalComponent {
  private readonly _ref = inject<MatDialogRef<CategoryGuideModalComponent>>(MatDialogRef);

  /** Категории (подпись + пояснение) для списка. */
  protected readonly categories = (
    Object.keys(MICRO_WIN_CATEGORY_LABELS) as MicroWinCategory[]
  ).map((key) => ({
    label: MICRO_WIN_CATEGORY_LABELS[key],
    description: MICRO_WIN_CATEGORY_DESCRIPTIONS[key],
  }));

  /** Закрывает модалку. */
  protected close(): void {
    this._ref.close();
  }
}
