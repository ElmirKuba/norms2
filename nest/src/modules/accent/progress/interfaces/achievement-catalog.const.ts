import { ACHIEVEMENT_CODES } from './user-achievement-full.interface';
import type { AchievementCode } from './user-achievement-full.interface';

/** Описание достижения в каталоге. */
export interface AchievementDefinition {
  /** Код (стабилен навсегда — он лежит в БД). */
  code: AchievementCode;
  /** Название. */
  title: string;
  /** Что произошло — текст для карточки уже выданного. */
  description: string;
  /** Как получить — текст для карточки ещё не выданного. Без давления и без «успей». */
  hint: string;
}

/**
 * Каталог достижений — **константы в коде, а не таблица**: локализация нам не нужна (продукт
 * одноязычный), а справочник на шесть строк не стоит миграции и join'а. В БД лежит только факт
 * выдачи (`user_achievements.code`), поэтому коды неизменны навсегда.
 *
 * **Тон текстов** ([ADR-0049](../../../../../../docs/decisions/0049-accent-product-principles.md)):
 * констатация, а не похвала свысока; в подсказках нет ни срочности, ни намёка, что человек
 * что-то упускает. Достижение — зеркало поступка, а не приз за лояльность приложению.
 */
export const ACHIEVEMENT_CATALOG: Readonly<Record<AchievementCode, AchievementDefinition>> = {
  returned: {
    code: 'returned',
    title: 'Вернулся',
    description: 'После перерыва ты снова отметил действие. Это и есть самое важное умение.',
    hint: 'Появится, если после долгого перерыва ты вернёшься и отметишь хоть что-нибудь.',
  },
  bad_day_saved: {
    code: 'bad_day_saved',
    title: 'Плохой день не пропал',
    description: 'В день, когда ничего не вышло по плану, ты всё равно сделал микро-победу.',
    hint: 'Появится, если в день без закрытых задач ты сделаешь хотя бы одну микро-победу.',
  },
  ladder_raised: {
    code: 'ladder_raised',
    title: 'Планка выросла',
    description: 'Система подняла тебе планку — значит прежняя стала лёгкой.',
    hint: 'Появится, когда привычка с адаптивной планкой пойдёт легко несколько дней подряд.',
  },
  first_step: {
    code: 'first_step',
    title: 'Первый шаг',
    description: 'Первая отмеченная задача. Дальше — только повторение.',
    hint: 'Появится, когда отметишь первую задачу.',
  },
  first_micro_win: {
    code: 'first_micro_win',
    title: 'Первая микро-победа',
    description: 'Ты сделал маленькое действие вместо ничего. Это работает лучше, чем кажется.',
    hint: 'Появится, когда сделаешь первую микро-победу.',
  },
  first_goal: {
    code: 'first_goal',
    title: 'Первая цель',
    description: 'Цель доведена до конца — от «хочу» до «сделано».',
    hint: 'Появится, когда доведёшь первую цель до 100%.',
  },
};

/** Каталог списком в порядке `ACHIEVEMENT_CODES` — для экрана статистики. */
export const ACHIEVEMENT_LIST: readonly AchievementDefinition[] = ACHIEVEMENT_CODES.map(
  (code) => ACHIEVEMENT_CATALOG[code],
);
