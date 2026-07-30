import type { EncounterOutcome, ObstacleType } from '../accent.types';

/** Вид препятствия для селекта и карточки: значение, человеческий ярлык, иконка. */
export interface ObstacleTypeOption {
  /** Ключ вида (как на бэке). */
  value: ObstacleType;
  /** Ярлык для человека. */
  label: string;
  /** Иконка. */
  icon: string;
}

/**
 * Виды препятствий (ADR-0062). Формулировки нейтральные: раздел называет **помеху**, а не
 * недостаток человека («избегание», а не «ты ленивый»).
 */
export const OBSTACLE_TYPE_OPTIONS: readonly ObstacleTypeOption[] = [
  { value: 'inner_critic', label: 'Внутренний критик', icon: '🗯️' },
  { value: 'avoidance', label: 'Избегание', icon: '🚪' },
  { value: 'distraction', label: 'Отвлечение', icon: '📱' },
  { value: 'body', label: 'Состояние тела', icon: '😴' },
  { value: 'emotion', label: 'Эмоции', icon: '🌪️' },
  { value: 'people', label: 'Люди и обязательства', icon: '👥' },
  { value: 'environment', label: 'Обстоятельства', icon: '🌧️' },
  { value: 'perfectionism', label: 'Перфекционизм', icon: '⚙️' },
];

/** Быстрый доступ к описанию вида по ключу. */
const BY_VALUE = new Map<ObstacleType, ObstacleTypeOption>(
  OBSTACLE_TYPE_OPTIONS.map((o) => [o.value, o]),
);

/**
 * Человеческий ярлык вида препятствия.
 * @param type Ключ вида.
 * @returns Ярлык («Отвлечение») или сам ключ, если вид неизвестен.
 */
export function obstacleTypeLabel(type: ObstacleType): string {
  return BY_VALUE.get(type)?.label ?? type;
}

/**
 * Иконка вида препятствия.
 * @param type Ключ вида.
 * @returns Эмодзи или «•».
 */
export function obstacleTypeIcon(type: ObstacleType): string {
  return BY_VALUE.get(type)?.icon ?? '•';
}

/**
 * Подпись частоты столкновений. Подаётся как информация для приоритета, а не счётчик позора
 * (ADR-0062, человеческая шляпа): при нуле — нейтральное «пока не отмечал».
 * @param count Сколько раз мешал за 30 дней.
 * @returns Готовая подпись.
 */
export function encountersLabel(count: number): string {
  if (count === 0) {
    return 'за месяц не отмечал';
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11 ? 'раз' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'раза' : 'раз';
  return `мешал ${String(count)} ${word} за месяц`;
}

/**
 * Подпись числа заготовленных ответов.
 * @param count Число контрмер.
 * @returns Готовая подпись.
 */
export function counterplaysLabel(count: number): string {
  if (count === 0) {
    return 'ответов пока нет';
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'ответ'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'ответа'
        : 'ответов';
  return `${String(count)} ${word}`;
}

/**
 * Подпись действенности контрмеры («помогало 3 из 4»). Пока оценок нет — пусто: отсутствие
 * оценок не должно выглядеть как «не работает».
 * @param helped Сколько раз отмечено «помогло».
 * @param rated Сколько применений оценено.
 * @returns Подпись или null, если оценок ещё нет.
 */
export function effectivenessLabel(helped: number, rated: number): string | null {
  if (rated === 0) {
    return null;
  }
  return `помогало ${String(helped)} из ${String(rated)}`;
}

/**
 * Ярлык исхода столкновения для ленты.
 * @param outcome Исход или null.
 * @returns Человеческая подпись или null, если исход не отмечен.
 */
export function outcomeLabel(outcome: EncounterOutcome | null): string | null {
  switch (outcome) {
    case 'helped':
      return '👍 помогло';
    case 'partly':
      return '🤏 частично';
    case 'no':
      return '🤷 не очень';
    default:
      return null;
  }
}

/**
 * Дата столкновения человеческим языком (сегодня/вчера/дата).
 * @param occurredAt Момент (unix ms).
 * @param now Текущий момент (unix ms).
 * @returns Готовая подпись.
 */
export function encounterWhen(occurredAt: number, now: number = Date.now()): string {
  const date = new Date(occurredAt);
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  if (occurredAt >= startOfToday.getTime()) {
    return `сегодня, ${time}`;
  }
  if (occurredAt >= startOfToday.getTime() - dayMs) {
    return `вчера, ${time}`;
  }
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${time}`;
}
