import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ATTRIBUTE_DESCRIPTIONS, HABIT_KIND_DESCRIPTIONS, HABIT_KIND_LABELS } from '../accent.types';
import type { HabitKind } from '../accent.types';
import {
  RECURRENCE_MODE_DESCRIPTIONS,
  RECURRENCE_MODE_LABELS,
} from './recurrence-builder.util';
import type { RecurrenceMode } from './recurrence-builder.util';

/**
 * Модалка-гид «Как заполнять привычку» (MatDialog, ADR-0026) — разжёвывает все поля
 * формы простым языком (Тип / Повтор / Лесенка / Сфера / Атрибуты). Открывается из
 * формы привычки (вложенный диалог), по аналогии с гидом категорий микро-побед.
 */
@Component({
  selector: 'app-habit-guide-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hg">
      <h2 class="hg__title">Как заполнять привычку</h2>
      <p class="hg__lead">Коротко по каждому полю. Не уверен — оставляй как есть, потом поправишь.</p>

      <section class="hg__sec">
        <h3 class="hg__h">Тип</h3>
        <p class="hg__hint">Как мерим выполнение.</p>
        <ul class="hg__list">
          @for (k of kinds; track k.label) {
            <li><b>{{ k.label }}</b> — {{ k.desc }}</li>
          }
        </ul>
      </section>

      <section class="hg__sec">
        <h3 class="hg__h">Повтор</h3>
        <p class="hg__hint">Как часто привычка появляется в задачах дня.</p>
        <ul class="hg__list">
          @for (m of modes; track m.label) {
            <li><b>{{ m.label }}</b> — {{ m.desc }}</li>
          }
        </ul>
      </section>

      <section class="hg__sec">
        <h3 class="hg__h">Лесенка — главная идея</h3>
        <p class="hg__hint">Чтобы расти без надрыва: от «смешно мало» к большой цели.</p>
        <ul class="hg__list">
          <li><b>Минимум</b> — что не стыдно сделать даже в худший день (1 отжимание, 1 строчка). С него серия не рвётся.</li>
          <li><b>Сейчас</b> — сегодняшняя планка.</li>
          <li><b>Цель</b> — куда растём (можно не указывать).</li>
          <li><b>Подстройка → «Адаптивно»</b> — планка <b>сама</b> поднимается, когда легко даётся, и мягко отступает, когда тяжело. Так доходят от 1 до 100, не сгорая.</li>
          <li><b>Подстройка → «Вручную»</b> — двигаешь планку сам.</li>
        </ul>
      </section>

      <section class="hg__sec">
        <h3 class="hg__h">Сфера (необязательно)</h3>
        <p class="hg__hint">К какой области жизни относится привычка (Здоровье, Работа, Отношения…). Просто для порядка — можно пропустить.</p>
      </section>

      <section class="hg__sec">
        <h3 class="hg__h">Атрибуты (необязательно)</h3>
        <p class="hg__hint">Как в RPG: дело прокачивает характеристику. Помогает видеть баланс. Не уверен — пропусти.</p>
        <ul class="hg__list">
          @for (a of attributes; track a.label) {
            <li>{{ a.label }}</li>
          }
        </ul>
      </section>

      <div class="hg__actions">
        <app-button (click)="close()">Понятно</app-button>
      </div>
    </div>
  `,
  styles: [
    `
      .hg__title {
        margin: 0 0 var(--space-2);
      }
      .hg__lead {
        margin: 0 0 var(--space-4);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hg__sec {
        margin-bottom: var(--space-4);
      }
      .hg__h {
        margin: 0 0 var(--space-1);
        font-size: var(--fs-md);
      }
      .hg__hint {
        margin: 0 0 var(--space-2);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hg__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hg__list b {
        color: var(--color-text);
        font-weight: var(--fw-medium);
      }
      .hg__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--space-2);
      }
    `,
  ],
})
export class HabitGuideModalComponent {
  private readonly _ref = inject<MatDialogRef<HabitGuideModalComponent>>(MatDialogRef);

  /** Типы привычек (подпись + пояснение). */
  protected readonly kinds = (Object.keys(HABIT_KIND_LABELS) as HabitKind[]).map((k) => ({
    label: HABIT_KIND_LABELS[k],
    desc: HABIT_KIND_DESCRIPTIONS[k],
  }));
  /** Режимы расписания (подпись + пояснение). */
  protected readonly modes = (Object.keys(RECURRENCE_MODE_LABELS) as RecurrenceMode[]).map((m) => ({
    label: RECURRENCE_MODE_LABELS[m],
    desc: RECURRENCE_MODE_DESCRIPTIONS[m],
  }));
  /** Атрибуты (пояснения). */
  protected readonly attributes = Object.keys(ATTRIBUTE_DESCRIPTIONS).map((key) => ({
    label: ATTRIBUTE_DESCRIPTIONS[key],
  }));

  /** Закрывает гид. */
  protected close(): void {
    this._ref.close();
  }
}
