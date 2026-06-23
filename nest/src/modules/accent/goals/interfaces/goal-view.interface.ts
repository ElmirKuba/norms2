import type { GoalDirection, GoalFull, GoalStatus } from './goal-full.interface';

/**
 * GoalView — цель наружу (без `accountId`/`pauseHistory`/таймстампов создания). Даты —
 * ISO-строки. **Вычисляемые поля прогресса** (`currentValue`/`percentage`/`daysLeft`/
 * `pace`/`forecast`/`projectedCompletionDate`, ADR-0052) добавятся в 2.5·9 — здесь пока
 * статическая проекция цели.
 */
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
  /** Стартовый пример (бейдж «пример»; не в работе/не принимает записи до присвоения, ADR-0051). */
  isStarter: boolean;
  /** Начало текущей паузы (ISO) или null. */
  pausedAt: string | null;
}

/**
 * Проецирует доменную цель в наружную view (скрывает accountId/историю пауз/таймстампы;
 * даты → ISO).
 * @param full Доменная сущность.
 * @returns Проекция наружу.
 */
export function toGoalView(full: GoalFull): GoalView {
  return {
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
    isStarter: full.isStarter,
    pausedAt: full.pausedAt ? full.pausedAt.toISOString() : null,
  };
}
