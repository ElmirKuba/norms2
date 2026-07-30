import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { effectivenessLabel } from './obstacle-format.util';
import type { CounterplayView } from '../accent.types';

/** Данные в модалку «Столкнулся». */
export interface EncounterModalData {
  /** Название препятствия (в заголовке). */
  obstacleName: string;
  /** Свои заготовленные ответы (в ручном порядке). */
  counterplays: readonly CounterplayView[];
}

/**
 * Что выбрал человек: конкретный ответ либо «просто отметить». Заметка опциональна.
 */
export interface EncounterModalResult {
  /** Выбранная контрмера или null («просто отметить»). */
  counterplayId: string | null;
  /** Заметка или null. */
  note: string | null;
}

/**
 * Модалка «Столкнулся» — **главный поток раздела** (ADR-0062 п.5). Открывается одним тапом и
 * показывает не анкету, а **свой список ответов**: выбрал — записалось. Кнопка «Просто
 * отметить» — легальный сценарий, когда разбираться некогда.
 *
 * Ничего обязательного: заметка спрятана за ссылкой, вопрос «помогло?» задаётся позже в ленте
 * и его можно игнорировать. В плохую минуту человек должен получить помощь за один тап.
 */
@Component({
  selector: 'app-obstacle-encounter-modal',
  imports: [FormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>«{{ data.obstacleName }}» — что делаем?</h2>
      </div>

      <div class="dlg__body enc__body">
        @if (data.counterplays.length === 0) {
          <p class="enc__muted">
            Ответов пока нет — можно просто отметить, что столкнулся, а заготовить их позже, на
            холодную голову.
          </p>
        } @else {
          <ul class="enc__list">
            @for (c of data.counterplays; track c.id) {
              <li>
                <button type="button" class="enc__cp" (click)="choose(c)">
                  <span class="enc__cp-text">
                    @if (c.linkedMicroWinId) {
                      <span aria-hidden="true">⏱</span>
                    }
                    {{ c.text }}
                  </span>
                  @if (effectiveness(c); as eff) {
                    <span class="enc__cp-eff">{{ eff }}</span>
                  }
                </button>
              </li>
            }
          </ul>
        }

        @if (showNote()) {
          <input
            class="enc__input"
            type="text"
            maxlength="2000"
            placeholder="Что происходило (необязательно)"
            [(ngModel)]="note"
          />
          <span class="enc__hint">Без реальных имён, телефонов и адресов.</span>
        } @else {
          <button type="button" class="enc__note-link" (click)="showNote.set(true)">
            + заметка
          </button>
        }
      </div>

      <div class="dlg__foot">
        <app-button variant="ghost" (click)="cancel()">Отмена</app-button>
        <app-button variant="ghost" (click)="justMark()">Просто отметить</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .enc__body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .enc__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .enc__cp {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .enc__cp:hover {
        border-color: var(--color-accent);
      }
      .enc__cp-eff {
        flex-shrink: 0;
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
      .enc__input {
        width: 100%;
        min-height: var(--touch-min);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font: inherit;
      }
      .enc__note-link {
        align-self: flex-start;
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        font: inherit;
        font-size: var(--fs-sm);
        cursor: pointer;
        padding: 0;
      }
      .enc__note-link:hover {
        color: var(--color-text);
      }
      .enc__hint,
      .enc__muted {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class ObstacleEncounterModalComponent {
  private readonly _ref =
    inject<MatDialogRef<ObstacleEncounterModalComponent, EncounterModalResult | null>>(
      MatDialogRef,
    );

  /** Данные модалки. */
  protected readonly data = inject<EncounterModalData>(MAT_DIALOG_DATA);

  /** Показать поле заметки (по умолчанию спрятано — лишнее поле в плохую минуту мешает). */
  protected readonly showNote = signal(false);
  /** Текст заметки. */
  protected note = '';

  /**
   * Подпись действенности ответа.
   * @param counterplay Контрмера.
   * @returns Подпись или null (оценок ещё нет).
   */
  protected effectiveness(counterplay: CounterplayView): string | null {
    return effectivenessLabel(counterplay.helpedCount, counterplay.ratedCount);
  }

  /**
   * Выбор конкретного ответа — записываем столкновение с ним.
   * @param counterplay Контрмера.
   */
  protected choose(counterplay: CounterplayView): void {
    this._ref.close({ counterplayId: counterplay.id, note: this._note() });
  }

  /** «Просто отметить» — записываем столкновение без ответа. */
  protected justMark(): void {
    this._ref.close({ counterplayId: null, note: this._note() });
  }

  /** Закрывает без записи. */
  protected cancel(): void {
    this._ref.close(null);
  }

  /**
   * Нормализует заметку.
   * @returns Текст или null.
   */
  private _note(): string | null {
    const trimmed = this.note.trim();
    return trimmed === '' ? null : trimmed;
  }
}
