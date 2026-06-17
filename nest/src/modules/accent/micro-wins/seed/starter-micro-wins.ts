import type { MicroWinCategory, UserState } from '../interfaces/micro-win-full.interface';

/** Шаблон стартовой микро-победы (без `accountId` — подставляется при севе). */
export interface StarterMicroWin {
  /** Название действия. */
  title: string;
  /** Категория нагрузки. */
  category: MicroWinCategory;
  /** Длительность в секундах. */
  durationSeconds: number;
  /** Цена энергии 1..3. */
  energyCost: number;
  /** Ожидаемый эффект или null. */
  effect: string | null;
  /** Состояния, в которых скрывать, или null. */
  disabledForStates: UserState[] | null;
}

/**
 * Персональный стартовый набор микро-побед — заводится один раз при первом обращении
 * аккаунта к разделу (2.2·5, идемпотентно по флагу `starter_micro_wins_seeded_at`).
 * Сознательно низко-энергозатратные (`energyCost` 1–2) действия-движения/самозабота —
 * доступны даже в `survival` (плохой день): чтобы у человека сразу была готовая
 * микро-победа под рукой вместо думскролла. North star раздела (README §1).
 */
export const STARTER_MICRO_WINS: readonly StarterMicroWin[] = [
  { title: '1 отжимание', category: 'physical', durationSeconds: 15, energyCost: 1, effect: null, disabledForStates: null },
  { title: 'Выпить стакан воды', category: 'physical', durationSeconds: 30, energyCost: 1, effect: null, disabledForStates: null },
  { title: 'Потянуться 1 минуту', category: 'physical', durationSeconds: 60, energyCost: 1, effect: null, disabledForStates: null },
  { title: 'Выйти на улицу или балкон на 5 минут', category: 'physical', durationSeconds: 300, energyCost: 2, effect: null, disabledForStates: null },
  { title: 'Сделать 5 глубоких вдохов', category: 'mental', durationSeconds: 60, energyCost: 1, effect: null, disabledForStates: null },
  { title: 'Убрать одну вещь на столе', category: 'household', durationSeconds: 120, energyCost: 1, effect: null, disabledForStates: null },
  { title: 'Записать одной строкой, что сейчас чувствуешь', category: 'emotional', durationSeconds: 120, energyCost: 1, effect: null, disabledForStates: null },
];
