import type { GoalDirection, GoalFull, GoalStatus } from './goal-full.interface';

/**
 * GoalView — цель наружу (без `accountId`/`pauseHistory`/таймстампов создания). Даты —
 * ISO-строки. **Вычисляемые поля прогресса** (`currentValue`/`percentage`/`daysLeft`/
 * `pace`/`forecast`/`projectedCompletionDate`, ADR-0052) добавятся в 2.5·9 — здесь пока
 * статическая проекция цели.
 */
/**
 * Привязанная микро-победа как «версия цели на плохой день» (2.7.2) — зеркало `TaskMinAction`
 * у задач: подпись кнопки и параметры таймера приходят вместе с целью.
 */
export interface GoalFallbackAction {
  /** Идентификатор микро-победы. */
  microWinId: string;
  /** Название («Выйти на улицу») — идёт прямо в подпись кнопки. */
  title: string;
  /** Длительность действия (сек) — для таймера. */
  durationSeconds: number;
  /** Подготовка перед действием (сек) или null. */
  prepSeconds: number | null;
}

export interface GoalView {
  /** Идентификатор. */
  id: string;
  /** Родительская цель или null (подцель). */
  parentGoalId: string | null;
  /** Название. */
  title: string;
  /** Зачем это важно или null. */
  whyItMatters: string | null;
  /** Ключ сферы или null. */
  domainKey: string | null;
  /** Ключи RPG-атрибутов. */
  attributes: string[];
  /** Род цели (accumulate/reach/reduce). */
  direction: GoalDirection;
  /** Единица измерения. */
  unit: string;
  /** Целевое значение. */
  targetValue: number;
  /** Базовый замер (reach/reduce) или null. */
  startValue: number | null;
  /** Дедлайн (YYYY-MM-DD) или null. */
  deadline: string | null;
  /** Статус жизненного цикла. */
  status: GoalStatus;
  /** Когда достигнута (ISO) или null. */
  completedAt: string | null;
  /** Текст «версия на плохой день» или null. */
  fallbackVersion: string | null;
  /** Микро-победа как версия цели на плохой день (опц.) — делает подсказку нажимаемой (2.7·H). */
  fallbackMicroWinId: string | null;
  /** «Ради чего откажусь» (mission-filter, ADR-0053) или null. */
  tradeoff: string | null;
  /** Стартовый пример (бейдж «пример»; не в работе/не принимает записи до присвоения, ADR-0051). */
  isStarter: boolean;
  /** Фокус (ADR-0053): null = не в фокусе; не-null = в фокусе + ранг (порядок). */
  focusOrder: number | null;
  /** Начало текущей паузы (ISO) или null. */
  pausedAt: string | null;
  /**
   * Развёрнутая «версия цели на плохой день» (2.7.2) — всё нужное для кнопки и таймера сразу,
   * чтобы экран цели не тянул каталог микро-побед вторым запросом. Заполняется только на чтении
   * одной цели; в списках и ответах мутаций — null.
   */
  fallbackAction: GoalFallbackAction | null;
}

/**
 * Проецирует доменную цель в наружную view (скрывает accountId/историю пауз/таймстампы;
 * даты → ISO).
 * @param full Доменная сущность.
 * @returns Проекция наружу.
 */
export function toGoalView(
  full: GoalFull,
  fallbackAction: GoalFallbackAction | null = null,
): GoalView {
  return {
    fallbackAction,
    id: full.id,
    parentGoalId: full.parentGoalId,
    title: full.title,
    whyItMatters: full.whyItMatters,
    domainKey: full.domainKey,
    attributes: full.attributes,
    direction: full.direction,
    unit: full.unit,
    targetValue: full.targetValue,
    startValue: full.startValue,
    deadline: full.deadline,
    status: full.status,
    completedAt: full.completedAt ? full.completedAt.toISOString() : null,
    fallbackVersion: full.fallbackVersion,
    fallbackMicroWinId: full.fallbackMicroWinId,
    tradeoff: full.tradeoff,
    isStarter: full.isStarter,
    focusOrder: full.focusOrder,
    pausedAt: full.pausedAt ? full.pausedAt.toISOString() : null,
  };
}
