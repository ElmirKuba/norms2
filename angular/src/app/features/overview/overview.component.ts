import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store.service';
import { StatsApiService } from './services/stats-api.service';
import { SpinnerComponent } from '../../shared/ui/spinner/spinner.component';
import type { OverviewStats } from './overview.types';

/** Длина окружности доната (r=52). */
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 52;

/**
 * Главный экран ЛК (обзор, F4). Сетка метрик-карточек (большое число + подпись) +
 * SVG-донат «полезность приглашённых» (активны/забанено, без либ). Данные — один
 * запрос `GET /stats/overview`. Точечные значения, без трендов/спарклайнов (нет
 * истории). Кубики будущих сервисов (Акцент/Музыка/…) — фазы 2+.
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

  /** Активных приглашённых (не забанены мной). */
  protected readonly activeInvitees = computed(() => {
    const s = this.stats();
    return s === null ? 0 : s.invitedDirect - s.inviteesBannedByMe;
  });

  /** Процент полезных или null (если никого не пригласил). */
  protected readonly usefulPercent = computed(() => {
    const s = this.stats();
    if (s === null || s.invitedDirect === 0) {
      return null;
    }
    return Math.round((this.activeInvitees() / s.invitedDirect) * 100);
  });

  /** Длина зелёной дуги доната. */
  protected readonly donutActiveLength = computed(() => {
    const percent = this.usefulPercent();
    return ((percent ?? 0) / 100) * DONUT_CIRCUMFERENCE;
  });

  /** Настроено ли восстановление. */
  protected readonly recoveryConfigured = computed(() => {
    const s = this.stats();
    return s !== null && s.recoveryQuestions > 0 && s.recoveryRequiredCount !== null;
  });

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
