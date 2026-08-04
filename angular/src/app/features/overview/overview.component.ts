import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { StatsApiService } from './services/stats-api.service';
import { SpinnerComponent } from '../../shared/ui/spinner/spinner.component';
import type { OverviewStats } from './overview.types';

/** Длина окружности доната (r=52). */
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 52;

/** Сегмент-дуга доната: длина, смещение старта по окружности и CSS-класс цвета. */
interface DonutSegment {
  length: number;
  offset: number;
  klass: string;
}

/**
 * Главный экран ЛК (обзор, F4 → бенто в 2.9·16). Герой — срез раздела «Акцент» (день,
 * постоянство, фокусная цель), под ним карточки аккаунта помельче + SVG-донат «полезность
 * приглашённых» (без либ). Данные — **один** запрос `GET /stats/overview`: срез раздела
 * приходит той же серверной агрегацией, а не вторым походом с фронта, иначе экран показывал
 * бы склейку двух моментов времени.
 *
 * Появятся другие разделы — встанут рядом такими же героями; заглушек «скоро» не рисуем:
 * экран не обещает того, чего нет.
 */
@Component({
  selector: 'app-overview',
  imports: [RouterLink, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent {
  private readonly _api = inject(StatsApiService);
  /** Текущий аккаунт (для приветствия). */
  protected readonly authStore = inject(AuthStore);

  /** Статистика или null. */
  protected readonly stats = signal<OverviewStats | null>(null);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Длина окружности доната (для шаблона). */
  protected readonly circumference = DONUT_CIRCUMFERENCE;

  /** Активных приглашённых (без активного бана — ни от меня, ни от вышестоящих). */
  protected readonly activeInvitees = computed(() => {
    const s = this.stats();
    return s === null ? 0 : s.invitedDirect - s.inviteesBannedByMe - s.inviteesBannedByAncestor;
  });

  /** Процент полезных или null (если никого не пригласил). */
  protected readonly usefulPercent = computed(() => {
    const s = this.stats();
    if (s === null || s.invitedDirect === 0) {
      return null;
    }
    return Math.round((this.activeInvitees() / s.invitedDirect) * 100);
  });

  /**
   * Сегменты доната (активны → забанено мной → забанено вышестоящими): дуги по
   * долям от invitedDirect, уложенные встык. `offset` = -накопленная_длина (старт
   * дуги по окружности). Нулевые сегменты дают дугу нулевой длины (не рисуются).
   */
  protected readonly donutSegments = computed<DonutSegment[]>(() => {
    const s = this.stats();
    if (s === null || s.invitedDirect === 0) {
      return [];
    }
    const total = s.invitedDirect;
    const parts: ReadonlyArray<{ count: number; klass: string }> = [
      { count: this.activeInvitees(), klass: 'donut__arc--active' },
      { count: s.inviteesBannedByMe, klass: 'donut__arc--banned-me' },
      { count: s.inviteesBannedByAncestor, klass: 'donut__arc--banned-ancestor' },
    ];
    const segments: DonutSegment[] = [];
    let cumulative = 0;
    for (const part of parts) {
      const length = (part.count / total) * DONUT_CIRCUMFERENCE;
      segments.push({ length, offset: -cumulative, klass: part.klass });
      cumulative += length;
    }
    return segments;
  });

  /** Настроено ли восстановление. */
  protected readonly recoveryConfigured = computed(() => {
    const s = this.stats();
    return s !== null && s.recoveryQuestions > 0 && s.recoveryRequiredCount !== null;
  });

  /**
   * Склонение «день/дня/дней». Число идёт крупно и отдельно от единицы, поэтому без склонения
   * фраза читается машинно («5 день с действием»).
   * @param count Количество дней.
   * @returns Слово в нужной форме.
   */
  protected dayWord(count: number): string {
    const tens = count % 100;
    const ones = count % 10;
    if (tens >= 11 && tens <= 14) {
      return 'дней';
    }
    if (ones === 1) {
      return 'день';
    }
    if (ones >= 2 && ones <= 4) {
      return 'дня';
    }
    return 'дней';
  }

  public constructor() {
    this._api.overview().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
