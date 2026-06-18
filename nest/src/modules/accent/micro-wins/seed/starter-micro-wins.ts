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
  // Телесное
  { title: '1 отжимание', category: 'physical', durationSeconds: 15, energyCost: 1, effect: 'Разгоняет кровь и сбивает оцепенение', disabledForStates: null },
  { title: 'Выпить стакан воды', category: 'physical', durationSeconds: 30, energyCost: 1, effect: 'Проясняет голову — мозг почти вода', disabledForStates: null },
  { title: 'Потянуться 1 минуту', category: 'physical', durationSeconds: 60, energyCost: 1, effect: 'Снимает зажатость, будит тело', disabledForStates: null },
  // Ум
  { title: 'Прочитать один абзац', category: 'mental', durationSeconds: 120, energyCost: 1, effect: 'Мягко включает мышление без перегруза', disabledForStates: null },
  // Эмоции
  { title: 'Сделать 5 медленных вдохов', category: 'emotional', durationSeconds: 60, energyCost: 1, effect: 'Гасит тревогу за минуту', disabledForStates: null },
  { title: 'Записать одной строкой, что сейчас чувствуешь', category: 'emotional', durationSeconds: 120, energyCost: 1, effect: 'Возвращает контакт с собой', disabledForStates: null },
  // Общение
  { title: 'Написать близкому одну строчку', category: 'social', durationSeconds: 120, energyCost: 1, effect: 'Один контакт ломает изоляцию', disabledForStates: null },
  // Сенсорика
  { title: 'Умыться прохладной водой', category: 'sensory', durationSeconds: 60, energyCost: 1, effect: 'Возвращает в «здесь и сейчас»', disabledForStates: null },
  { title: 'Включить любимую песню', category: 'sensory', durationSeconds: 180, energyCost: 1, effect: 'Быстро меняет состояние', disabledForStates: null },
  // Быт
  { title: 'Убрать одну вещь на столе', category: 'household', durationSeconds: 120, energyCost: 1, effect: 'Порядок снаружи — порядок внутри', disabledForStates: null },
  // Цифровое / внимание
  { title: 'Отложить телефон в другую комнату на 15 минут', category: 'digital', durationSeconds: 60, energyCost: 2, effect: 'Разрывает залипание в ленте', disabledForStates: null },
  { title: 'Закрыть лишние вкладки и ленты', category: 'digital', durationSeconds: 60, energyCost: 1, effect: 'Снимает информационный шум', disabledForStates: null },
  // Отдых
  { title: 'Полежать 5 минут с закрытыми глазами', category: 'rest', durationSeconds: 300, energyCost: 1, effect: 'Разрешить себе отдых — тоже победа', disabledForStates: null },
  // Дух / смысл
  { title: 'Назвать 3 вещи, за которые благодарен', category: 'spiritual', durationSeconds: 120, energyCost: 1, effect: 'Смещает фокус с нехватки на то, что есть', disabledForStates: null },
  // Природа
  { title: 'Выйти на улицу или балкон на 5 минут', category: 'nature', durationSeconds: 300, energyCost: 2, effect: 'Свет и воздух перезапускают день', disabledForStates: null },
  { title: 'Посмотреть на небо одну минуту', category: 'nature', durationSeconds: 60, energyCost: 1, effect: 'Расширяет взгляд, сбивает туннель плохого дня', disabledForStates: null },
  // Границы / отказ
  { title: 'Сказать «не сегодня» одной необязательной просьбе', category: 'boundaries', durationSeconds: 60, energyCost: 1, effect: 'Отказ от лишнего бережёт остаток сил', disabledForStates: null },
];
