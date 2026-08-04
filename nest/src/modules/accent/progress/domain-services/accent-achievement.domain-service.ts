import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_PROGRESS_NOTIFIER } from '../adapters/accent-progress-notifier.port';
import { ACCENT_USER_ACHIEVEMENT_REPOSITORY } from '../adapters/accent-user-achievement-repository.port';
import { ACHIEVEMENT_CATALOG } from '../interfaces/achievement-catalog.const';
import { ACHIEVEMENT_CODES } from '../interfaces/user-achievement-full.interface';
import type { AccentProgressNotifierPort } from '../adapters/accent-progress-notifier.port';
import type { AccentUserAchievementRepositoryPort } from '../adapters/accent-user-achievement-repository.port';
import type { PersistenceView } from '../interfaces/persistence.interface';
import type {
  AchievementCode,
  UserAchievementFull,
} from '../interfaces/user-achievement-full.interface';

/**
 * Факты, по которым решается выдача. Все шесть достижений **выводятся из уже имеющихся данных** —
 * поэтому трекерам не пришлось заводить ни одного порта событий и подписки: правила считаются
 * при чтении, там же, где и постоянство.
 */
export interface AchievementFacts {
  /** Постоянство — источник `returned` (счётчик возвращений). */
  persistence: PersistenceView;
  /** Была ли хоть одна закрытая задача — `first_step`. */
  hasTaskCompletion: boolean;
  /** Дни с закрытыми задачами — вместе с днями микро-побед дают `bad_day_saved`. */
  taskDays: readonly string[];
  /** Дни с микро-победами — `first_micro_win` и `bad_day_saved`. */
  microWinDays: readonly string[];
  /** Есть ли доведённая до конца цель — `first_goal`. */
  hasCompletedGoal: boolean;
  /** Поднималась ли хоть у одной привычки планка — `ladder_raised`. */
  hasRaisedLadder: boolean;
}

/**
 * Выдача достижений (2.9·4). **Ленивая, при чтении** — как материализация дня и вехи «держусь»:
 * все правила выводимы из данных, значит подписываться на события трекеров незачем. Это не
 * компромисс, а следствие решения «факты вместо очков»: очки надо было бы начислять в момент
 * действия, факт — можно увидеть когда угодно.
 *
 * Достижения — **за поступок, а не за количество** ([паспорт §4.2](../../../../../../docs/sections/accent/gamification-passport.md)),
 * каждое выдаётся один раз за всё время (правило держит уникальный индекс в БД).
 */
@Injectable()
export class AccentAchievementDomainService {
  /**
   * @param _repository Репозиторий выданных достижений (порт).
   * @param _notifier Доставка уведомления (порт).
   */
  public constructor(
    @Inject(ACCENT_USER_ACHIEVEMENT_REPOSITORY)
    private readonly _repository: AccentUserAchievementRepositoryPort,
    @Inject(ACCENT_PROGRESS_NOTIFIER)
    private readonly _notifier: AccentProgressNotifierPort,
  ) {}

  /**
   * Проверяет правила и выдаёт то, что заслужено и ещё не выдано.
   * @param accountId Идентификатор аккаунта.
   * @param facts Готовые факты (ничего не запрашивает сам).
   * @returns Вновь выданные достижения (пусто — обычный случай).
   */
  public async sync(
    accountId: string,
    facts: AchievementFacts,
  ): Promise<UserAchievementFull[]> {
    const awarded = await this._repository.awardedCodes(accountId);
    const pending = ACHIEVEMENT_CODES.filter(
      (code) => !awarded.has(code) && this._deserves(code, facts),
    );
    if (pending.length === 0) {
      return [];
    }

    const fresh: UserAchievementFull[] = [];
    for (const code of pending) {
      const created = await this._repository.award(accountId, code, this._context(code, facts));
      // null = кто-то успел выдать это же достижение параллельно; тогда и уведомлять не надо.
      if (created === null) {
        continue;
      }
      fresh.push(created);
      const definition = ACHIEVEMENT_CATALOG[code];
      await this._notifier.milestone(accountId, definition.title, definition.description);
    }
    return fresh;
  }

  /**
   * Правило одного достижения.
   * @param code Код.
   * @param facts Факты.
   * @returns true, если заслужено.
   */
  private _deserves(code: AchievementCode, facts: AchievementFacts): boolean {
    switch (code) {
      case 'returned':
        return facts.persistence.returnCount > 0;
      case 'bad_day_saved':
        // День, спасённый микро-победой: она была, а закрытых задач в этот день — ни одной.
        return facts.microWinDays.some((day) => !facts.taskDays.includes(day));
      case 'ladder_raised':
        return facts.hasRaisedLadder;
      case 'first_step':
        return facts.hasTaskCompletion;
      case 'first_micro_win':
        return facts.microWinDays.length > 0;
      case 'first_goal':
        return facts.hasCompletedGoal;
    }
  }

  /**
   * Человекочитаемая деталь момента для карточки (или null, если добавить нечего).
   * @param code Код.
   * @param facts Факты.
   * @returns Подпись или null.
   */
  private _context(code: AchievementCode, facts: AchievementFacts): string | null {
    if (code === 'returned' && facts.persistence.lastReturnSilenceDays !== null) {
      return `после ${facts.persistence.lastReturnSilenceDays} дней тишины`;
    }
    return null;
  }
}
