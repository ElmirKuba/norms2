import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../shared/ui/button/button.component';

/** Данные модалки шэринга: готовая публичная ссылка-приглашение. */
export interface InviteShareData {
  /** `<origin>/invite?code=CODE`. */
  url: string;
}

/**
 * Модалка «Поделиться приглашением» (MatDialog): показывает публичную ссылку `/invite?code=…` и
 * даёт два явных действия — **скопировать** ссылку и **открыть** страницу-поздравление (превью).
 * Где есть системный шэринг (Web Share API, обычно мобилки) — добавляется кнопка «Поделиться…».
 * Без «магии»: пользователь видит саму ссылку и сам решает, что с ней сделать.
 */
@Component({
  selector: 'app-invite-share-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <div class="dlg__head">
        <h2>Поделиться приглашением</h2>
      </div>
      <div class="dlg__body ishare">
        <p class="ishare__lead">
          Отправь эту ссылку тому, кого зовёшь. Он попадёт на страницу-приглашение и оттуда — к
          регистрации (код подставится сам).
        </p>
        <p class="ishare__url" tabindex="0">{{ data.url }}</p>
        <div class="ishare__actions">
          <app-button (click)="copy()">{{ copied() ? '✓ Скопировано' : '📋 Скопировать ссылку' }}</app-button>
          <app-button variant="ghost" (click)="open()">↗ Открыть страницу</app-button>
          @if (canNativeShare) {
            <app-button variant="ghost" (click)="nativeShare()">Поделиться…</app-button>
          }
        </div>
      </div>
      <div class="dlg__foot">
        <app-button variant="ghost" (click)="close()">Закрыть</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .dlg__head {
        padding: var(--space-4) var(--space-4) 0;
      }
      .dlg__head h2 {
        margin: 0;
      }
      .ishare {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
      }
      .ishare__lead {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .ishare__url {
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font-family: var(--font-mono, monospace);
        font-size: var(--fs-sm);
        word-break: break-all;
        user-select: all;
      }
      .ishare__url:focus {
        outline: none;
        border-color: var(--color-accent);
      }
      .ishare__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .dlg__foot {
        display: flex;
        justify-content: flex-end;
        padding: 0 var(--space-4) var(--space-4);
      }
    `,
  ],
})
export class InviteShareModalComponent {
  private readonly _ref = inject<MatDialogRef<InviteShareModalComponent, void>>(MatDialogRef);
  protected readonly data = inject<InviteShareData>(MAT_DIALOG_DATA);

  /** Ссылка скопирована (для отметки «✓»). */
  protected readonly copied = signal(false);
  /** Доступен ли системный шэринг (Web Share API). */
  protected readonly canNativeShare = typeof navigator.share === 'function';

  /** Копирует ссылку в буфер, показывает «✓». */
  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Буфер недоступен — ссылка и так видна, можно выделить и скопировать вручную.
      this.copied.set(false);
    }
  }

  /** Открывает страницу-поздравление в новой вкладке (превью). */
  protected open(): void {
    window.open(this.data.url, '_blank', 'noopener');
  }

  /** Системный «Поделиться» (где доступен). Отмена — тихо. */
  protected async nativeShare(): Promise<void> {
    try {
      await navigator.share({
        title: 'Приглашение в «Нормисы»',
        text: 'Тебя приглашают в «Нормисы» — заходи по ссылке 🎉',
        url: this.data.url,
      });
    } catch {
      /* пользователь отменил системный диалог — молча */
    }
  }

  /** Закрывает модалку. */
  protected close(): void {
    this._ref.close();
  }
}
