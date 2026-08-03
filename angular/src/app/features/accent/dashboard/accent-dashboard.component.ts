import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { ModalService } from '../../../shared/modals/modal.service';
import { MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { AccentTimerModalComponent } from '../shared/accent-timer-modal.component';
import type { AccentTimerData, AccentTimerResult } from '../shared/accent-timer-modal.component';
import type { DashboardView } from '../accent.types';

/**
 * Главный экран «Акцента» (2.11) — **кокпит, а не витрина**.
 *
 * Наверху **«Сейчас»**: одно дело и одна кнопка. Выбирает его бэк по правилам
 * ([ADR-0063](../../../../../docs/decisions/0063-no-llm-in-critical-path.md) — ИИ в критическом
 * пути нет); чек-ин состояния (2.8) не добавит блок, а уточнит выбор внутри того же механизма.
 *
 * Ниже — честная сводка дня (2.11·5) и чек-лист первых шагов для новичка (2.11·6). Пустые блоки
 * **не рисуем вовсе**: экран показывает то, что есть, и не изображает наполненность.
 */
@Component({
  selector: 'app-accent-dashboard',
  imports: [RouterLink, ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dash">
      @if (loading()) {
        <p class="dash__muted">Загрузка…</p>
      } @else if (error()) {
        <p class="dash__error">{{ error() }}</p>
      } @else if (data(); as d) {
        <app-card>
          <div class="dash__now" [attr.data-kind]="d.now.kind">
            <span class="dash__now-label">{{ nowLabel(d) }}</span>
            @if (d.now.title; as title) {
              <strong class="dash__now-title">{{ title }}</strong>
            }
            <p class="dash__now-hint">{{ nowHint(d) }}</p>
            @if (d.now.kind !== 'all_done') {
              <div class="dash__now-actions">
                <app-button [loading]="acting()" (click)="act(d)">{{ actionLabel(d) }}</app-button>
                @if (d.now.kind !== 'micro_win') {
                  <app-button variant="ghost" [routerLink]="['../habits']">Все задачи</app-button>
                }
              </div>
            }
          </div>
        </app-card>

        @if (d.pausedFrom !== null) {
          <div class="dash__paused">
            <span>Раздел на паузе с {{ pausedLabel(d.pausedFrom) }} — вернёшься, когда будешь готов.</span>
            <app-button variant="ghost" [loading]="busy()" (click)="resume()">Снять паузу</app-button>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .dash {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .dash__muted {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .dash__error {
        color: var(--color-danger);
        font-size: var(--fs-sm);
      }
      .dash__now {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .dash__now-label {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .dash__now-title {
        font-size: var(--fs-xl);
        line-height: 1.2;
      }
      .dash__now-hint {
        margin: 0;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      /* Просрочка — единственное, что уже подвело: выделяем акцентом, но без красной паники. */
      .dash__now[data-kind='overdue'] .dash__now-label {
        color: var(--color-accent);
      }
      .dash__now-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-top: var(--space-1);
      }
      .dash__paused {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
    `,
  ],
})
export class AccentDashboardComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _modal = inject(ModalService);
  private readonly _dialog = inject(MatDialog);
  private readonly _router = inject(Router);

  /** Снимок главного экрана. */
  protected readonly data = signal<DashboardView | null>(null);
  /** Первичная загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки. */
  protected readonly error = signal<string | null>(null);
  /** Идёт действие по «Сейчас». */
  protected readonly acting = signal(false);
  /** Идёт снятие паузы. */
  protected readonly busy = signal(false);

  public constructor() {
    this._load();
  }

  /**
   * Подпись над делом — простыми словами, как везде в разделе.
   * @param view Снимок.
   * @returns Подпись.
   */
  protected nowLabel(view: DashboardView): string {
    switch (view.now.kind) {
      case 'overdue':
        return 'Подгорает';
      case 'task':
        return 'Сейчас';
      case 'micro_win':
        return 'Если есть силы';
      default:
        return 'На сегодня всё';
    }
  }

  /**
   * Пояснение под делом. Для «всё сделано» — похвала, а не выдуманное дело; для пустого дня —
   * «так и должно быть», чтобы отсутствие задач не читалось как упрёк.
   * @param view Снимок.
   * @returns Текст.
   */
  protected nowHint(view: DashboardView): string {
    switch (view.now.kind) {
      case 'overdue':
        return 'Срок прошёл — но сделать всё ещё можно.';
      case 'task':
        return 'Одно дело. Не список — просто начни с него.';
      case 'micro_win':
        return 'День закрыт. Это по желанию, не обязанность.';
      default:
        return view.today.total > 0
          ? 'Всё закрыто. Отдыхай — этого достаточно.'
          : 'Сегодня по расписанию ничего нет. Это нормально.';
    }
  }

  /**
   * Подпись кнопки действия.
   * @param view Снимок.
   * @returns Подпись.
   */
  protected actionLabel(view: DashboardView): string {
    return view.now.kind === 'micro_win' ? '▶ Сделать' : 'Открыть';
  }

  /**
   * Действие по «Сейчас». Микро-победу запускаем таймером прямо здесь — от «хочу» до «делаю»
   * один тап; задачу открываем в «Привычках», где живут её кнопки и ввод значения (дублировать
   * их на дашборде значило бы завести второй экран задач).
   * @param view Снимок.
   */
  protected act(view: DashboardView): void {
    if (view.now.kind === 'micro_win' && view.now.microWinId !== null) {
      this._runMicroWin(view.now.microWinId, view.now.title ?? '');
      return;
    }
    void this._router.navigate(['/app/accent/habits']);
  }

  /** Снимает паузу раздела. */
  protected resume(): void {
    this.busy.set(true);
    this._api.resume().subscribe({
      next: () => {
        this.busy.set(false);
        this._load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this._modal.error('Не удалось снять с паузы', errorMessage(err));
      },
    });
  }

  /**
   * Дата начала паузы по-человечески.
   * @param iso Момент (ISO).
   * @returns Строка.
   */
  protected pausedLabel(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Запускает таймер микро-победы и по зачёту перечитывает снимок: «Сейчас» сразу становится
   * следующим делом, а не остаётся с уже сделанным.
   * @param microWinId Идентификатор микро-победы.
   * @param title Название (заголовок таймера).
   */
  private _runMicroWin(microWinId: string, title: string): void {
    const ref = this._dialog.open<
      AccentTimerModalComponent,
      AccentTimerData,
      AccentTimerResult | null
    >(AccentTimerModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      disableClose: true,
      data: { title, durationSeconds: 60, prepSeconds: null, mode: 'binary' },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.status !== 'done') {
        return;
      }
      this.acting.set(true);
      this._api.completeMicroWin(microWinId).subscribe({
        next: () => {
          this.acting.set(false);
          this._load();
        },
        error: (err: unknown) => {
          this.acting.set(false);
          this._modal.error('Не удалось засчитать', errorMessage(err));
        },
      });
    });
  }

  /** Загружает снимок главного экрана. */
  private _load(): void {
    this.loading.set(true);
    this._api.getDashboard().subscribe({
      next: (view) => {
        this.data.set(view);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
