import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { FocusTargetDirective } from '../../../shared/ui/focus-target.directive';
import { HscrollHintDirective } from '../../../shared/ui/hscroll-hint.directive';
import { ModalService } from '../../../shared/modals/modal.service';
import { DataFreshnessService } from '../../../core/freshness/data-freshness.service';
import { MODAL_MEDIUM_WIDTH, MODAL_SMALL_WIDTH } from '../../../shared/modals/modals.constants';
import { DayPickerModalComponent } from './day-picker-modal.component';
import type { DayPickerData } from './day-picker-modal.component';
import { errorMessage } from '../../../core/http/error-message.util';
import { AccentApiService } from '../services/accent-api.service';
import { HABIT_KIND_LABELS } from '../accent.types';
import type { HabitPayload, HabitView, LadderEventView, TaskView } from '../accent.types';
import { CLOCK_ANCHOR_MINUTES, anchorMinutesToTime, timeToAnchorMinutes } from './clock.util';
import { recurrenceLabel } from './recurrence-label.util';
import { HabitFormModalComponent } from './habit-form-modal.component';
import type { HabitFormData } from './habit-form-modal.component';
import { AccentTimerModalComponent } from '../shared/accent-timer-modal.component';
import type { AccentTimerData, AccentTimerResult } from '../shared/accent-timer-modal.component';

/**
 * Экран привычек (`/accent/habits`, 2.4) — вкладки **Сегодня** (дневной чеклист, ·17) и
 * **Шаблоны** (управление привычками: список + деактивация, ·15; CRUD-модалка — ·16).
 * Тонкий слой над `AccentApiService`. Signals, OnPush, чистый SCSS.
 */
@Component({
  selector: 'app-habits',
  imports: [
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    HscrollHintDirective,
    FocusTargetDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hb">
      <header class="hb__head">
        <h2>Привычки</h2>
        <div class="hb__head-actions" appHscrollHint [appHscrollHintDelay]="1300">
          @if (tab() === 'templates' && habits().length > 0) {
            @if (hasStarters()) {
              <app-button variant="ghost" [loading]="packBusy()" (click)="clearExamples()">
                <span aria-hidden="true">🧹</span>
                Очистить примеры
              </app-button>
            } @else {
              <app-button variant="ghost" [loading]="packBusy()" (click)="seedPack()">
                <span aria-hidden="true">🎁</span>
                Получить пак
              </app-button>
            }
          }
          <span class="tooltip-host" [attr.data-tooltip]="'Добавить привычку'">
            <app-button ariaLabel="Добавить привычку" (click)="openCreate()">+</app-button>
          </span>
        </div>
      </header>

      <aside class="hb__why">
        <span class="hb__why-icon" aria-hidden="true">🪜</span>
        <p class="hb__why-text">
          <strong>Не идеально, а постоянно.</strong> Маленькие регулярные шаги; лесенка бережёт от
          выгорания — в трудный день делаешь минимум, и серия цела.
        </p>
      </aside>

      <nav class="hb__tabs">
        <button type="button" [class.active]="tab() === 'today'" (click)="selectTab('today')">Сегодня</button>
        <button type="button" [class.active]="tab() === 'templates'" (click)="selectTab('templates')">Шаблоны</button>
        <button type="button" [class.active]="tab() === 'archived'" (click)="selectTab('archived')">В архиве</button>
      </nav>

      @if (tab() === 'today') {
        <!-- Навигация по дням (2.10·B3): прошлое доступно только на чтение, будущее закрыто
             ответом сервера. Дни без содержимого не выбираются — попадать в пустоту незачем. -->
        <div class="hb__daynav">
          <button
            type="button"
            class="hb__daynav-day"
            (click)="openDayPicker()"
            aria-label="Выбрать день в календаре"
          >
            <span class="hb__daynav-label">{{ dayLabel() }}</span>
            <span class="hb__daynav-caret" aria-hidden="true">▾</span>
          </button>
          @if (!isToday()) {
            <app-button variant="ghost" (click)="goToday()">Сегодня</app-button>
            <span class="hb__daynav-readonly">только просмотр</span>
          }
        </div>

        @if (syncNotice(); as notice) {
          <div class="hb__flash" data-event="sync" role="status">
            <span>{{ notice }}</span>
            <button type="button" class="hb__flash-x" (click)="syncNotice.set(null)" aria-label="Закрыть">×</button>
          </div>
        }
        @if (ladderFlash(); as flash) {
          <div class="hb__flash" [attr.data-event]="flash.event" role="status">
            <span>{{ flash.text }}</span>
            <button type="button" class="hb__flash-x" (click)="dismissFlash()" aria-label="Закрыть">×</button>
          </div>
        }
        @if (tasksLoading()) {
          <p class="hb__muted">Загрузка…</p>
        } @else if (tasksError()) {
          <p class="hb__error">{{ tasksError() }}</p>
        } @else if (tasks().length === 0) {
          <app-empty-state
            title="На сегодня ничего не запланировано"
            text="Создай привычку в «Шаблонах» — и она появится здесь по своему расписанию."
          />
          <div class="hb__empty-cta">
            <app-button (click)="selectTab('templates')">Перейти в шаблоны</app-button>
          </div>
        } @else {
          <div class="hb__progress">
            <span>Сегодня сделано: <b>{{ donePercent() }}%</b></span>
            <span class="hb__streak">🔥 серия — скоро</span>
          </div>
          <ul class="hb__list">
            @for (t of tasks(); track t.id) {
              <!-- Цель перехода с дашборда: «Открыть» ведёт сюда с ?focus=<id> задачи, и она
                   сама себя показывает — раньше человек искал её глазами в списке (2.9·20). -->
              <li [appFocusTarget]="t.id">
                <app-card>
                  <div class="hb__item">
                    <div class="hb__main">
                      <span class="hb__name-row">
                        @if (t.templateId; as templateId) {
                          <a class="hb__name hb__link" [class.hb__done]="t.status === 'done'"
                            [routerLink]="[templateId]">{{ t.title }}</a>
                        } @else {
                          <strong class="hb__name" [class.hb__done]="t.status === 'done'">{{ t.title }}</strong>
                        }
                        @if (t.carriedFromPostpone) {
                          <span class="hb__carried" title="Перенесена с прошлого дня">⤴ со вчера</span>
                        }
                      </span>
                      <span class="hb__meta">{{ taskMeta(t) }}</span>
                    </div>
                    <div class="hb__actions">
                      <span class="hb__badge" [attr.data-status]="t.status">{{ statusLabel(t) }}</span>
                      <!-- Прошлое только для чтения (2.10·B1): в прошедшем дне живой остаётся
                           одна информация — что тогда вышло. Кнопки там не просто бесполезны, они
                           врут: «→ Завтра» из 7 августа означал бы перенос на 8-е, тоже в прошлое. -->
                      @if (isToday()) {
                      @if (t.status === 'pending' || t.status === 'partial') {
                        @if (t.kind === 'binary') {
                          <app-button [loading]="busyTaskId() === t.id" (click)="completeTask(t)">Сделал</app-button>
                        } @else if (t.kind === 'clock') {
                          <input #ctime class="hb__numin" type="time" [value]="clockDisplay(t.targetValue)" />
                          <app-button [loading]="busyTaskId() === t.id" (click)="recordClock(t, ctime.value)">Отметить</app-button>
                        } @else {
                          <input #val class="hb__numin" type="number" min="0" [value]="t.targetValue ?? 1" />
                          <app-button [loading]="busyTaskId() === t.id" (click)="completeTask(t, val.value)">Отметить</app-button>
                          @if (t.kind === 'timed') {
                            <app-button
                              variant="ghost"
                              [disabled]="busyTaskId() === t.id"
                              title="Засечь время с таймером (с остатка, с паузой)"
                              (click)="openTimer(t)"
                            >▶ засечь</app-button>
                          }
                        }
                      }
                      @if (t.status === 'done' || t.status === 'partial') {
                        <app-button variant="ghost" (click)="uncompleteTask(t)">Отменить</app-button>
                      }
                      @if (t.status === 'pending') {
                        <app-button variant="ghost" (click)="postpone(t)">→ Завтра</app-button>
                      }
                      @if (t.status === 'skipped' && t.skipReason === 'postponed') {
                        <app-button
                          variant="ghost"
                          [loading]="busyTaskId() === t.id"
                          title="Силы вернулись? Верни это на сегодня"
                          (click)="unpostpone(t)"
                        >↩ Вернуть на сегодня</app-button>
                      }
                      }
                    </div>
                  </div>
                  @if (isToday() && t.status === 'pending' && !t.minAction && minText(t); as text) {
                    <div class="hb__min-row">
                      <span class="hb__min-text">🌙 На плохой день: {{ text }}</span>
                    </div>
                  }
                  @if (isToday() && t.status === 'pending' && t.minAction; as min) {
                    <div class="hb__min-row">
                      <app-button
                        variant="ghost"
                        [loading]="busyTaskId() === t.id"
                        title="Плохой день? Сделай минимум — серия не порвётся"
                        (click)="doMinimum(t)"
                      >🌙 Минимум сегодня: {{ min.title }}</app-button>
                    </div>
                  }
                </app-card>
              </li>
            }
          </ul>
        }
      } @else {
        @if (loading()) {
          <p class="hb__muted">Загрузка…</p>
        } @else if (error()) {
          <p class="hb__error">{{ error() }}</p>
        } @else if (habits().length === 0 && tab() === 'archived') {
          <app-empty-state
            title="В архиве пусто"
            text="Сюда попадают привычки, убранные с глаз. Они не удалены — вернуть можно в любой момент."
          />
        } @else if (habits().length === 0) {
          <app-empty-state
            title="Пока нет привычек"
            text="Начни с готового набора — примеры с мягкой планкой, по силам даже в плохой день. Или заведи свою."
          >
            <app-button [loading]="packBusy()" (click)="seedPack()">
              <span aria-hidden="true">🎁</span>
              Получить стартовый пак
            </app-button>
            <app-button variant="ghost" (click)="openCreate()">Создать свою</app-button>
          </app-empty-state>
        } @else {
          @if (hasStarters()) {
            <p class="hb__hint">«Добавить себе» или «⋯» → ✏️ Изменить оставит привычку себе — и она начнёт появляться в «Сегодня».</p>
          }
          <ul class="hb__list" cdkDropList (cdkDropListDropped)="dropHabit($event)">
            @for (h of habits(); track h.id) {
              <li cdkDrag>
                <app-card>
                  <div class="hb__item">
                    <button type="button" class="hb__grip" cdkDragHandle aria-label="Перетащить">⠿</button>
                    <div class="hb__main">
                      <span class="hb__name-row">
                        <a class="hb__name hb__link" [routerLink]="[h.id]">{{ h.icon ? h.icon + ' ' : '' }}{{ h.title }}</a>
                        @if (h.isStarter) {
                          <span class="hb__example">пример</span>
                        }
                      </span>
                      <span class="hb__meta">
                        {{ kindLabel(h.kind) }} · {{ recurrenceText(h.recurrence) }} · {{ ladderText(h) }}
                      </span>
                      @if (h.description) {
                        <span class="hb__desc">{{ h.description }}</span>
                      }
                      @if (h.minVersion) {
                        <span class="hb__min-text">🌙 На плохой день: {{ h.minVersion }}</span>
                      }
                    </div>
                    <div class="hb__actions">
                      @if (h.isStarter) {
                        <app-button [loading]="busyId() === h.id" (click)="adoptHabit(h)">Добавить себе</app-button>
                      }
                      <div class="hb__menu-wrap">
                        <span class="tooltip-host tooltip-host--end" [attr.data-tooltip]="'Дополнительные опции'">
                          <button
                            type="button"
                            class="hb__menu-btn"
                            aria-label="Дополнительные опции"
                            (click)="toggleMenu(h.id, $event)"
                          >⋯</button>
                        </span>
                        @if (openMenuId() === h.id) {
                          <div class="hb__menu" (click)="$event.stopPropagation()">
                            <button type="button" class="hb__menu-item" (click)="openEdit(h); closeMenu()">
                              <span class="hb__menu-ico" aria-hidden="true">✏️</span>
                              Изменить
                            </button>
                            @if (tab() === 'archived') {
                              <button type="button" class="hb__menu-item" (click)="restore(h); closeMenu()">
                                <span class="hb__menu-ico" aria-hidden="true">↩️</span>
                                Вернуть в работу
                              </button>
                            } @else {
                              <button type="button" class="hb__menu-item" (click)="deactivate(h); closeMenu()">
                                <span class="hb__menu-ico" aria-hidden="true">📦</span>
                                В архив
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </app-card>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [
    `
      .hb {
        padding: var(--space-4) 0;
      }
      .hb__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      /* Текст «минимума на плохой день»: человек его вписал в форме — значит должен видеть и
         на экране, а не только при редактировании (2.7.2). */
      .hb__min-text {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }
      .hb__min-row {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--space-2);
      }
      .hb__actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        // Держим блок действий у правого края даже при переносе на свою строку —
        // иначе «⋯» уезжает влево и меню (right:0) раскрывается за край экрана.
        margin-left: auto;
      }
      .hb__head-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: nowrap;
        overflow-x: auto;
        min-width: 0;
        scroll-behavior: smooth;
        // Полоса скрыта во всех браузерах (крутим пальцем/нуджем — appHscrollHint).
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .hb__head-actions::-webkit-scrollbar {
        display: none;
      }
      .hb__head-actions .btn {
        flex-shrink: 0;
      }
      .hb__hint {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        margin: 0 0 var(--space-3);
      }
      /* Название ведёт в историю привычки (2.7.3). Кликаем именно по названию, а не по всей
         карточке: на ней уже живёт меню «⋯», и два обработчика дрались бы за один тап. */
      .hb__link {
        color: inherit;
        text-decoration: none;
      }
      .hb__link:hover {
        color: var(--color-accent);
        text-decoration: underline;
      }
      .hb__name-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .hb__example {
        font-size: var(--fs-xs);
        color: var(--color-accent);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-2);
      }
      .hb__carried {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
        background: var(--color-surface-2);
        border-radius: var(--radius-sm);
        padding: 0 var(--space-2);
        white-space: nowrap;
      }
      .hb__menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .hb__menu-btn {
        min-width: var(--touch-min);
        min-height: var(--touch-min);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--fs-lg);
        line-height: 1;
      }
      .hb__menu-btn:hover {
        color: var(--color-text);
        border-color: var(--color-text-muted);
      }
      .hb__menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        min-width: 160px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-1);
        overflow: hidden;
      }
      .hb__menu-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        text-align: left;
        padding: var(--space-2) var(--space-3);
        min-height: var(--touch-min);
        background: none;
        border: none;
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .hb__menu-item:hover {
        background: var(--color-surface-2);
      }
      .hb__menu-item--danger {
        color: var(--color-danger);
      }
      .hb__menu-ico {
        width: 1.2em;
        text-align: center;
        flex-shrink: 0;
      }
      .hb__tabs {
        display: flex;
        gap: var(--space-3);
        margin: var(--space-3) 0 var(--space-4);
        border-bottom: 1px solid var(--color-border);
      }
      .hb__tabs button {
        padding: var(--space-2) var(--space-1);
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--color-text-muted);
        cursor: pointer;
      }
      .hb__tabs button.active {
        color: var(--color-text);
        border-bottom-color: var(--color-accent);
      }
      .hb__muted {
        color: var(--color-text-muted);
      }
      .hb__why {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        margin: var(--space-3) 0 0;
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-2);
        border-left: 3px solid var(--color-accent);
        border-radius: var(--radius-md);
      }
      .hb__why-icon {
        font-size: var(--fs-lg);
        line-height: 1.3;
      }
      .hb__why-text {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hb__why-text strong {
        color: var(--color-text);
      }
      .hb__empty-cta {
        display: flex;
        justify-content: center;
        margin-top: var(--space-4);
      }
      .hb__daynav {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .hb__daynav-arrow {
        min-width: 36px;
        min-height: 36px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: none;
        color: var(--color-text);
        font-size: var(--fs-lg);
        line-height: 1;
        cursor: pointer;
      }

      .hb__daynav-arrow:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .hb__daynav-day {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text);
        font-size: var(--fs-md);
        cursor: pointer;
      }

      .hb__daynav-caret {
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
      }

      .hb__daynav-day:hover {
        border-color: var(--color-accent);
      }

      .hb__daynav-label {
        min-width: 140px;
        font-weight: var(--fw-medium);
      }

      .hb__daynav-readonly {
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
      }

      .hb__flash {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
        font-size: var(--fs-sm);
      }
      .hb__flash[data-event='raised'] {
        border-color: var(--color-accent);
      }
      /* Нейтральная плашка синхронизации (2.7.1): это не успех и не ошибка — просто «показываю
         актуальное», поэтому без акцентного цвета. */
      .hb__flash[data-event='sync'] {
        border-color: var(--color-border);
        color: var(--color-text-muted);
      }
      .hb__flash-x {
        flex-shrink: 0;
        width: var(--touch-min);
        min-height: var(--touch-min);
        background: none;
        border: none;
        color: var(--color-text-muted);
        font-size: var(--fs-lg);
        line-height: 1;
        cursor: pointer;
      }
      .hb__progress {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
        color: var(--color-text-muted);
        flex-wrap: wrap;
      }
      .hb__streak {
        font-size: var(--fs-sm);
      }
      .hb__done {
        text-decoration: line-through;
        opacity: 0.7;
      }
      .hb__badge {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        white-space: nowrap;
      }
      .hb__badge[data-status='done'] {
        color: var(--color-accent);
        font-weight: 600;
      }
      .hb__numin {
        width: 64px;
        min-height: var(--touch-min);
        padding: 0 var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-2);
        color: var(--color-text);
      }
      .hb__error {
        color: var(--color-danger);
      }
      .hb__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .hb__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .hb__grip {
        border: none;
        background: transparent;
        cursor: grab;
        color: var(--color-text-muted);
        font-size: var(--fs-md);
        line-height: 1;
        padding: 0 var(--space-1);
        touch-action: none;
      }
      .hb__grip:active {
        cursor: grabbing;
      }
      .cdk-drag-preview {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      }
      .cdk-drag-placeholder {
        opacity: 0.4;
      }
      .hb__main {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }
      .hb__name {
        font-size: var(--fs-md);
      }
      .hb__meta {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
      .hb__desc {
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
        font-style: italic;
      }
    `,
  ],
})
export class HabitsComponent {
  private readonly _api = inject(AccentApiService);
  private readonly _modal = inject(ModalService);
  private readonly _freshness = inject(DataFreshnessService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _dialog = inject(MatDialog);

  /** Активная вкладка. */
  protected readonly tab = signal<'today' | 'templates' | 'archived'>('today');
  /** Список привычек. */
  protected readonly habits = signal<HabitView[]>([]);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Ошибка загрузки (или null). */
  protected readonly error = signal<string | null>(null);
  /** Id привычки в процессе деактивации/присвоения. */
  protected readonly busyId = signal<string | null>(null);
  /** Идёт получение/очистка стартового пака. */
  protected readonly packBusy = signal(false);
  /** Есть ли непринятые примеры (для хинта и контекстной кнопки). */
  protected readonly hasStarters = computed(() => this.habits().some((h) => h.isStarter));
  /** Id карточки с открытым меню «⋯» (Изменить/Удалить) или null. */
  protected readonly openMenuId = signal<string | null>(null);

  /** Переключает меню «⋯» карточки; stopPropagation — чтобы document-клик не закрыл сразу. */
  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((cur) => (cur === id ? null : id));
  }

  /** Закрывает меню «⋯». */
  protected closeMenu(): void {
    this.openMenuId.set(null);
  }

  /** Клик где угодно вне меню — закрыть. */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
    }
  }

  /** Escape — закрыть открытое меню. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.openMenuId.set(null);
  }
  /** Задачи дня (вкладка «Сегодня»). */
  protected readonly tasks = signal<TaskView[]>([]);
  /** Сегодняшний день в поясе аккаунта — считает бэк, но для подписей нужен и здесь. */
  protected readonly today = signal(new Date().toISOString().slice(0, 10));
  /** Выбранный день (по умолчанию сегодня). */
  protected readonly selectedDay = signal(new Date().toISOString().slice(0, 10));
  /** Дни, в которые что-то было — из карты дней. */
  protected readonly daysWithContent = signal<string[]>([]);
  /** Идёт загрузка задач дня. */
  protected readonly tasksLoading = signal(false);
  /** Ошибка загрузки задач (или null). */
  protected readonly tasksError = signal<string | null>(null);
  /** Id задачи в процессе отметки (для спиннера). */
  protected readonly busyTaskId = signal<string | null>(null);
  /** Фидбэк движения лесенки (баннер «планка выросла / мягче») или null. */
  protected readonly ladderFlash = signal<{ event: 'raised' | 'lowered'; text: string } | null>(null);
  /**
   * Мягкое уведомление о том, что данные разъехались с другим устройством (2.7.1). Не ошибка:
   * человек ничего не сделал не так, просто экран показывал вчерашнюю правду.
   */
  protected readonly syncNotice = signal<string | null>(null);

  /** % дня: задачи с прогрессом (done/partial) от всех непропущенных. */
  protected readonly donePercent = computed(() => {
    const active = this.tasks().filter((t) => t.status !== 'skipped');
    if (active.length === 0) {
      return 0;
    }
    const done = active.filter((t) => t.status === 'done' || t.status === 'partial').length;
    return Math.round((done / active.length) * 100);
  });

  public constructor() {
    this._load();
    // Дефолтная вкладка — «Сегодня»: грузим задачи сразу на старте (а не только по клику
    // на вкладку). Иначе при заходе/обновлении страницы прямо на «Сегодня» список пуст,
    // пока не переключишь вкладки (H#B2-4).
    if (this.tab() === 'today') {
      this._loadTasks();
      // Карта дней (2.10·B3) — по ней работают стрелки: между отметками бывают недели пустоты,
      // и пролистывать их по одному дню было бы работой, которую человек не просил.
      this._loadDayMap();
    }
    // Свежесть (2.7.1): вернулся к вкладке после телефона — задачи дня перечитываются тихо.
    // Только «Сегодня»: устаревший список шаблонов ничему не вредит, а вот отметки — вредят.
    this._freshness.registerFor(this._destroyRef, () => {
      if (this.tab() === 'today') {
        this._loadTasks();
      }
    });
  }

  /** Переключает вкладку; при «Сегодня» — (пере)загружает задачи (материализация на бэке). */
  protected selectTab(tab: 'today' | 'templates' | 'archived'): void {
    const wasArchived = this.tab() === 'archived';
    this.tab.set(tab);
    if (tab === 'today') {
      this._loadTasks();
      return;
    }
    // Между «Шаблонами» и «В архиве» меняется не вкладка, а выборка — список надо перечитать.
    if (wasArchived !== (tab === 'archived')) {
      this._load();
    }
  }

  /**
   * Возвращает шаблон привычки из архива в работу.
   * @param habit Привычка.
   */
  protected restore(habit: HabitView): void {
    this.busyId.set(habit.id);
    this._api.restoreHabit(habit.id).subscribe({
      next: () => {
        this.habits.update((list) => list.filter((h) => h.id !== habit.id));
        this.busyId.set(null);
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this._modal.error('Не удалось вернуть', errorMessage(err));
      },
    });
  }

  /** Метаданные задачи (тип + явные «надо/сделано» — без неявной дроби). */
  protected taskMeta(task: TaskView): string {
    // Разовая задача (`templateId = null`) ничем не отличалась от порождённой привычкой, хотя
    // ведёт себя иначе: живёт один день, её нельзя открыть как шаблон и у неё нет лесенки.
    // Пока разовых нет ни у кого, это незаметно; появятся — список станет непонятным (2.9·22).
    const kind =
      task.templateId === null
        ? `Разовая · ${HABIT_KIND_LABELS[task.kind]}`
        : HABIT_KIND_LABELS[task.kind];
    if (task.targetValue === null) {
      return kind; // бинарная — без чисел
    }
    if (task.kind === 'clock') {
      // Clock (FEAT-H2): цель/факт — время суток («минуты от якоря» → HH:MM).
      const need = `не позже ${this.clockDisplay(task.targetValue)}`;
      return task.doneValue === null
        ? `${kind} · ${need}`
        : `${kind} · ${need}, лёг в ${this.clockDisplay(task.doneValue)}`;
    }
    const need = `надо: ${String(task.targetValue)}`;
    if (task.doneValue === null) {
      return `${kind} · ${need}`; // ещё не выполнена
    }
    return `${kind} · ${need}, сделано: ${String(task.doneValue)}`;
  }

  /** «Минуты от вечернего якоря» → «HH:MM» для clock-задач; null → пусто. */
  protected clockDisplay(mfa: number | null): string {
    return mfa === null ? '' : anchorMinutesToTime(mfa, CLOCK_ANCHOR_MINUTES);
  }

  /** Зачёт clock-задачи: введённое время отбоя → «минуты от якоря» → обычный complete. */
  protected recordClock(task: TaskView, timeStr: string): void {
    const mfa = timeToAnchorMinutes(timeStr, CLOCK_ANCHOR_MINUTES);
    if (mfa === null) {
      return; // некорректное время — не отправляем
    }
    this.completeTask(task, String(mfa));
  }

  /** Подпись статуса задачи. */
  protected statusLabel(task: TaskView): string {
    switch (task.status) {
      case 'done':
        return '✓ Сделано';
      case 'partial':
        return `Частично ${String(task.doneValue ?? 0)}`;
      case 'skipped':
        return task.skipReason === 'postponed' ? 'Перенесено' : 'Пропущено';
      case 'pending':
        // В прошедшем дне «Ожидает» обещает действие, которого там уже не будет: отметить нельзя
        // (2.10·B1), и слово читается как вечный долг. Факт вместо ожидания (замечание Elmir
        // 17.08.2026).
        return this.isToday() ? 'Ожидает' : 'Не отмечено';
    }
  }

  /**
   * **«Минимум сегодня»** (2.7·H): открывает таймер привязанной микро-победы, а по завершении
   * одним запросом засчитывает и её, и задачу частично (`minTarget`). Серия держится, лесенка не
   * двигается. Отмена таймера — ничего не пишем: человек передумал, а не «провалил».
   * @param task Задача дня с привязанным минимумом.
   */
  protected doMinimum(task: TaskView): void {
    const min = task.minAction;
    if (!min || this.busyTaskId() !== null) {
      return;
    }
    const ref = this._dialog.open<
      AccentTimerModalComponent,
      AccentTimerData,
      AccentTimerResult | null
    >(AccentTimerModalComponent, {
      width: MODAL_SMALL_WIDTH,
      panelClass: 'modal-flush',
      disableClose: true,
      data: {
        title: min.title,
        durationSeconds: min.durationSeconds,
        prepSeconds: min.prepSeconds,
        mode: 'binary',
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.status !== 'done') {
        return;
      }
      this.busyTaskId.set(task.id);
      this._api.completeMinimumTask(task.id).subscribe({
        next: (res) => {
          this._patchTask(res.task);
          this.busyTaskId.set(null);
        },
        error: (err: unknown) => {
          this.busyTaskId.set(null);
          this._modal.error('Не удалось засчитать минимум', errorMessage(err));
        },
      });
    });
  }

  /**
   * Отмечает выполнение задачи (binary — без значения; иначе — введённое). Двигает лесенку на бэке.
   * @param task Задача дня.
   * @param rawValue Введённое значение (для quantitative/timed).
   * @param replace Осознанная замена результата меньшим значением — «Начать сначала» в таймере
   *   (2.7.1): без этого флага бэк защищает уже записанный результат от понижения.
   */
  protected completeTask(task: TaskView, rawValue?: string, replace = false): void {
    const doneValue =
      task.kind === 'binary' || rawValue === undefined || rawValue.trim() === ''
        ? undefined
        : Number(rawValue);
    if (doneValue !== undefined && (!Number.isFinite(doneValue) || doneValue < 0)) {
      return;
    }
    this.busyTaskId.set(task.id);
    // Пока летит мутация, обновление по фокусу откладывается — иначе список моргнёт под руками.
    const release = this._freshness.hold();
    this._api.completeTask(task.id, doneValue, replace).subscribe({
      next: (result) => {
        this._patchTask(result.task);
        this._flashLadder(result.ladderEvent, task);
        this.busyTaskId.set(null);
        this._freshness.markFresh();
        release();
      },
      error: (err: unknown) => {
        this.busyTaskId.set(null);
        release();
        this._handleCompleteError(err);
      },
    });
  }

  /**
   * Разбирает ошибку отметки. `409 TASK_VALUE_DOWNGRADE` (2.7.1) означает, что экран показывал
   * устаревшее: задачу уже отметили с лучшим результатом с другого устройства. Не ругаемся и **не
   * просим перезагрузить** — молча перечитываем день и говорим, что произошло.
   * @param err Ошибка запроса.
   */
  private _handleCompleteError(err: unknown): void {
    const code =
      typeof err === 'object' && err !== null && 'error' in err
        ? ((err as { error?: { error?: { code?: string } } }).error?.error?.code ?? null)
        : null;
    if (code === 'TASK_VALUE_DOWNGRADE') {
      this._loadTasks();
      this.syncNotice.set('Эта задача уже отмечена с другого устройства — показываю актуальное.');
      return;
    }
    this._modal.error('Не удалось отметить', errorMessage(err));
  }

  /**
   * Фокус-таймер для `timed`-задачи (FEAT-H1, [ADR-0057]): считает **остаток** = `target − сделано`
   * (напр. час на дорожке, 30 мин уже сделано → таймер на оставшиеся 30 мин), с паузой. По зачёту —
   * общий `completeTask` с **накопленным** значением (`сделано + прошедшее`, не заново; бэк
   * перезаписывает `doneValue`). `≥ target` → done, иначе partial (`≥ minTarget` держит серию).
   * Отмена — без записи. Общий таймер-компонент (как у микро-побед). Бэк не трогается.
   */
  protected openTimer(task: TaskView): void {
    const done = task.doneValue ?? 0;
    const target = task.targetValue ?? 0;
    const remaining = Math.max(0, target - done);
    if (remaining <= 0) {
      return; // цель уже набрана — таймер не нужен
    }
    // Время подготовки берём с самой привычки (шаблона задачи), если задано (FEAT-H1).
    const prep = this.habits().find((h) => h.id === task.templateId)?.prepSeconds ?? null;
    const ref = this._dialog.open<AccentTimerModalComponent, AccentTimerData, AccentTimerResult | null>(
      AccentTimerModalComponent,
      {
        width: MODAL_SMALL_WIDTH,
        panelClass: 'modal-flush',
        disableClose: true,
        // Полная длительность = target; при наличии прогресса — предложить выбор «продолжить с остатка».
        data: {
          title: task.title,
          durationSeconds: target,
          prepSeconds: prep,
          mode: 'duration',
          resumeSeconds: done > 0 ? remaining : null,
        },
      },
    );
    ref.afterClosed().subscribe((result) => {
      if (result?.status !== 'done') {
        return;
      }
      // «Сначала» (fromRestart) — заменить прогресс; «Продолжить» — накопить к сделанному.
      // Замена может оказаться МЕНЬШЕ уже записанного (засчитал раньше срока) — это единственное
      // легальное понижение, поэтому идёт с явным `replace` (2.7.1), иначе бэк вернёт 409.
      const total = result.fromRestart ? result.performedSeconds : done + result.performedSeconds;
      this.completeTask(task, String(total), result.fromRestart);
    });
  }

  /**
   * Показывает баннер-фидбэк движения лесенки. Текст — конкретный: какая привычка и
   * было→стало (с «сек» для timed). НЕ авто-скрывается — пользователь закрывает сам
   * (крестик), чтобы успеть прочитать похвалу. null — ничего.
   */
  private _flashLadder(event: LadderEventView, task: TaskView): void {
    if (event === null) {
      return;
    }
    if (task.kind === 'clock') {
      // Clock (FEAT-H2, полярность lower): «raised» = ужесточение = отбой РАНЬШЕ; показываем времена.
      const change = `${this.clockDisplay(event.prevTarget)} → ${this.clockDisplay(event.newTarget)}`;
      const text =
        event.direction === 'raised'
          ? `🌙 «${task.title}»: сдвигаем отбой раньше, ${change} — режим подтягивается. Молодец!`
          : `😌 «${task.title}»: даём чуть позже, ${change} — это нормально, серия цела.`;
      this.ladderFlash.set({ event: event.direction, text });
      return;
    }
    const unit = task.kind === 'timed' ? ' сек' : '';
    const change = `${String(event.prevTarget)}${unit} → ${String(event.newTarget)}${unit}`;
    const text =
      event.direction === 'raised'
        ? `🎉 «${task.title}»: планка выросла, ${change} — стало чуть сложнее. Ты справляешься!`
        : `🌙 «${task.title}»: планка мягче, ${change} — это нормально, серия цела.`;
    this.ladderFlash.set({ event: event.direction, text });
  }

  /**
   * Текст «минимума на плохой день» для задачи дня (2.7.2). Берётся с её привычки-шаблона —
   * шаблоны грузятся всегда, независимо от вкладки. Нужен там, где микро-победа НЕ привязана:
   * кнопки нет, но человек написал себе запасной вариант, и увидеть его он должен на экране, а
   * не только в форме редактирования.
   * @param task Задача дня.
   * @returns Текст минимума или null.
   */
  protected minText(task: TaskView): string | null {
    if (task.templateId === null) {
      return null;
    }
    return this.habits().find((h) => h.id === task.templateId)?.minVersion ?? null;
  }

  /** Закрывает баннер-фидбэк вручную. */
  protected dismissFlash(): void {
    this.ladderFlash.set(null);
  }

  /** Снимает отметку выполнения. */
  protected uncompleteTask(task: TaskView): void {
    this.busyTaskId.set(task.id);
    this._api.uncompleteTask(task.id).subscribe({
      next: (updated) => {
        this._patchTask(updated);
        this.busyTaskId.set(null);
      },
      error: () => this.busyTaskId.set(null),
    });
  }

  /**
   * Возвращает перенесённую задачу обратно на сегодня (2.7.2): силы вернулись — забираем её
   * из завтра. Список дня перечитываем целиком: на сервере исчезла завтрашняя копия, и
   * точечная замена одной строки этого не покажет.
   * @param task Перенесённая задача.
   */
  protected unpostpone(task: TaskView): void {
    this.busyTaskId.set(task.id);
    const release = this._freshness.hold();
    this._api.unpostponeTask(task.id).subscribe({
      next: () => {
        this.busyTaskId.set(null);
        release();
        this._loadTasks();
      },
      error: (err: unknown) => {
        this.busyTaskId.set(null);
        release();
        this._modal.error('Не удалось вернуть задачу', errorMessage(err));
      },
    });
  }

  /** Переносит задачу на завтра (текущая → перенесена; список дня обновляем). */
  protected postpone(task: TaskView): void {
    this.busyTaskId.set(task.id);
    this._api.postponeTask(task.id).subscribe({
      next: () => {
        this.busyTaskId.set(null);
        this._loadTasks();
      },
      error: () => this.busyTaskId.set(null),
    });
  }

  /** Заменяет задачу в списке дня обновлённой версией. */
  private _patchTask(updated: TaskView): void {
    this.tasks.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }

  /**
   * Открывает календарь выбора дня.
   *
   * Пришёл на смену стрелкам «шаг к следующему дню с записями» (замечание Elmir 17.08.2026):
   * стрелка не показывает, что впереди, и человек листает историю вслепую — он не видит ни
   * сколько дней позади, ни где в них дыры. Календарь отвечает на это одним взглядом.
   * @returns Ничего.
   */
  protected openDayPicker(): void {
    void this._dialog
      .open<DayPickerModalComponent, DayPickerData, string>(DayPickerModalComponent, {
        width: MODAL_SMALL_WIDTH,
        autoFocus: false,
        data: {
          selected: this.selectedDay(),
          today: this.today(),
          daysWithContent: this.daysWithContent(),
        },
      })
      .afterClosed()
      .subscribe((day) => {
        if (typeof day === 'string' && day !== this.selectedDay()) {
          this.selectedDay.set(day);
          this._loadTasks();
        }
      });
  }

  /**
   * Возвращает к сегодняшнему дню.
   * @returns Ничего.
   */
  protected goToday(): void {
    this.selectedDay.set(this.today());
    this._loadTasks();
  }

  /**
   * Выбран ли сегодняшний день.
   * @returns `true`, если сегодня.
   */
  protected isToday(): boolean {
    return this.selectedDay() === this.today();
  }

  /**
   * Подпись выбранного дня: «сегодня» словом, остальные — датой.
   * @returns Текст подписи.
   */
  protected dayLabel(): string {
    if (this.isToday()) {
      return 'Сегодня';
    }
    const [year, month, day] = this.selectedDay().split('-').map(Number);
    if (year === undefined || month === undefined || day === undefined) {
      return this.selectedDay();
    }
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      weekday: 'short',
    }).format(new Date(year, month - 1, day));
  }

  /**
   * Подтягивает карту дней за последние полгода — по ней работают стрелки.
   * @returns Ничего.
   */
  private _loadDayMap(): void {
    const to = this.today();
    const from = new Date(Date.parse(to) - 183 * 86_400_000).toISOString().slice(0, 10);
    this._api.listDayMap(from, to).subscribe({
      next: (rows) => this.daysWithContent.set(rows.map((row) => row.date)),
      error: () => this.daysWithContent.set([]),
    });
  }

  private _loadTasks(): void {
    this.tasksLoading.set(true);
    this._api.listTasks(this.isToday() ? undefined : this.selectedDay()).subscribe({
      next: (items) => {
        this.tasks.set(items);
        this.tasksError.set(null);
        this.tasksLoading.set(false);
      },
      error: (err: unknown) => {
        this.tasksError.set(errorMessage(err));
        this.tasksLoading.set(false);
      },
    });
  }

  /** RU-подпись типа привычки. */
  protected kindLabel(kind: HabitView['kind']): string {
    return HABIT_KIND_LABELS[kind];
  }

  /** Человекочитаемое расписание (RRULE). */
  protected recurrenceText(recurrence: string): string {
    return recurrenceLabel(recurrence);
  }

  /** Сводка лесенки: текущая цель (→ потолок). */
  protected ladderText(habit: HabitView): string {
    const { currentTarget, goalTarget } = habit.ladder;
    if (habit.kind === 'clock') {
      const anchor = habit.ladder.anchorMinutes ?? CLOCK_ANCHOR_MINUTES;
      const cur = anchorMinutesToTime(currentTarget, anchor);
      return goalTarget === null
        ? `не позже ${cur}`
        : `${cur} → ${anchorMinutesToTime(goalTarget, anchor)}`;
    }
    return goalTarget === null ? `цель ${String(currentTarget)}` : `${String(currentTarget)} → ${String(goalTarget)}`;
  }

  private _load(): void {
    this.loading.set(true);
    this._api.listHabits(this.tab() === 'archived').subscribe({
      next: (items) => {
        this.habits.set(items);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Drag-reorder привычек (ADR-0054, → priority): оптимистично + reorderHabits; откат при ошибке. */
  protected dropHabit(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.habits()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.habits.set(next);
    this._api.reorderHabits(next.map((h) => h.id)).subscribe({
      error: (err: unknown) => {
        this._load();
        this._modal.error('Не удалось сохранить порядок', errorMessage(err));
      },
    });
  }

  /** Получить стартовый пак привычек (докидывает примеры) — список приходит свежим. */
  protected seedPack(): void {
    this.packBusy.set(true);
    this._api.seedHabitStarterPack().subscribe({
      next: (items) => {
        this.habits.set(items);
        this.packBusy.set(false);
      },
      error: () => this.packBusy.set(false),
    });
  }

  /** Очистить примеры (только непринятые стартовые) — список приходит свежим. */
  protected clearExamples(): void {
    this.packBusy.set(true);
    this._api.clearHabitStarters().subscribe({
      next: (items) => {
        this.habits.set(items);
        this.packBusy.set(false);
      },
      error: () => this.packBusy.set(false),
    });
  }

  /** Присвоить пример себе («Добавить себе»): снимает флаг → начнёт давать задачи. */
  protected adoptHabit(habit: HabitView): void {
    this.busyId.set(habit.id);
    this._api.adoptHabit(habit.id).subscribe({
      next: (updated) => {
        this.habits.update((list) => list.map((h) => (h.id === updated.id ? updated : h)));
        this.busyId.set(null);
      },
      error: () => this.busyId.set(null),
    });
  }

  /** Открывает модалку создания привычки. */
  protected openCreate(): void {
    this._openForm({}, (payload) => this._api.createHabit(payload));
  }

  /** Открывает модалку редактирования привычки. */
  protected openEdit(habit: HabitView): void {
    this._openForm({ habit }, (payload) => this._api.updateHabit(habit.id, payload));
  }

  /**
   * Открывает форму привычки и применяет результат через переданный API-вызов.
   * @param data Данные модалки (привычка для редактирования или пусто).
   * @param submit Функция сохранения по payload.
   */
  private _openForm(
    data: HabitFormData,
    submit: (payload: HabitPayload) => ReturnType<AccentApiService['createHabit']>,
  ): void {
    const ref = this._dialog.open<HabitFormModalComponent, HabitFormData, HabitPayload | null>(
      HabitFormModalComponent,
      { width: MODAL_MEDIUM_WIDTH, panelClass: 'modal-flush', data: { ...data, submit } },
    );
    // Сохранение делает САМА форма (закрывается лишь при успехе) → здесь только перезагрузка
    // списка. Ошибка показывается внутри формы, ввод не теряется (H#B2-9).
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this._load();
      }
    });
  }

  /**
   * Убирает шаблон привычки в архив.
   *
   * **Раньше пункт назывался «Удалить», а делал архив** — и вернуть привычку было нечем: экрана
   * скрытых не существовало. Слово исправлено вместе с появлением вкладки «В архиве»
   * ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
   * @param habit Привычка.
   */
  protected deactivate(habit: HabitView): void {
    void this._modal
      .confirm({
        title: 'Убрать в архив?',
        text: `«${habit.title}» перестанет появляться в задачах дня. История останется, вернуть можно на вкладке «В архиве».`,
        confirmText: 'В архив',
      })
      .then((ok) => {
        if (!ok) {
          return;
        }
        this.busyId.set(habit.id);
        this._api.deactivateHabit(habit.id).subscribe({
          next: () => {
            this.habits.update((list) => list.filter((h) => h.id !== habit.id));
            this.busyId.set(null);
          },
          error: (err: unknown) => {
            this.busyId.set(null);
            this._modal.error('Не удалось удалить', errorMessage(err));
          },
        });
      });
  }
}
