import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_PROGRESS_NOTIFIER } from '../adapters/accent-progress-notifier.port';
import type { AccentProgressNotifierPort } from '../adapters/accent-progress-notifier.port';
import type { ReachedMilestone } from '../../anti-habits/domain-services/accent-anti-habit.domain-service';

/**
 * Уведомления о вехах «держусь» (2.9·5). Сами вехи живут в **журнале таймлайна**
 * (`anti_habit_events.goal_reached`, ADR-0060) — новой таблицы не понадобилось, и в истории
 * анти-привычки веха видна на своём месте. Здесь только решение «о чём сообщить человеку».
 *
 * **Показываем одну веху на анти-привычку — старшую.** Человек, не заходивший две недели,
 * догонит сразу три порога (3, 7, 14 дней); три строки подряд об одном и том же — это спам,
 * а не радость. Старшая включает младшие по смыслу.
 */
@Injectable()
export class AccentMilestoneNoticeDomainService {
  /**
   * @param _notifier Доставка уведомления (порт).
   */
  public constructor(
    @Inject(ACCENT_PROGRESS_NOTIFIER)
    private readonly _notifier: AccentProgressNotifierPort,
  ) {}

  /**
   * Сообщает о вехах: по одной, старшей, на каждую анти-привычку.
   * @param accountId Кому.
   * @param milestones Впервые записанные вехи (может быть пусто).
   * @returns Те вехи, о которых сообщили.
   */
  public async announce(
    accountId: string,
    milestones: readonly ReachedMilestone[],
  ): Promise<ReachedMilestone[]> {
    const top = new Map<string, ReachedMilestone>();
    for (const milestone of milestones) {
      const known = top.get(milestone.antiHabitId);
      if (known === undefined || milestone.thresholdDays > known.thresholdDays) {
        top.set(milestone.antiHabitId, milestone);
      }
    }

    const announced = [...top.values()];
    for (const milestone of announced) {
      // Текст строим на `label` («3 дня», «неделя», «полгода»), а не на числе: у порогов уже
      // есть готовая форма, а число потребовало бы склонения и всё равно ломалось бы на
      // «месяц»/«год». Тон — констатация: ни восклицаний, ни «не сорвись теперь».
      await this._notifier.milestone(
        accountId,
        `${milestone.label} без срыва`,
        `«${milestone.title}» — рубеж пройден.`,
      );
    }
    return announced;
  }
}
