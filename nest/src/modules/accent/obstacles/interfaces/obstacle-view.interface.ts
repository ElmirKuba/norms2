import type { ObstacleFull, ObstacleType } from './obstacle-full.interface';

/**
 * ObstacleView — препятствие наружу (без `accountId`/`version`: CAS по версии для препятствий
 * пока не включён — колонка есть и bump'ается, строгая проверка включается там, где гонка
 * реальна, [ADR-0035](../../../../../docs/decisions/0035-concurrency-control.md), уточнение).
 *
 * **Вычисляемые на чтение агрегаты** (ADR-0052, счётчиков не храним): `counterplaysCount`
 * (блок C) и `encountersLast30` — «мешал N раз за 30 дней» (блок D). Частота подаётся как
 * информация для приоритета, а не счётчик позора (ADR-0062, человеческая шляпа).
 */
export interface ObstacleView {
  /** Идентификатор. */
  id: string;
  /** Название («Думскролл»). */
  name: string;
  /** Вид препятствия — ось «природа проблемы» (ADR-0062). */
  type: ObstacleType;
  /** Сфера жизни (вторая ось) или null. */
  domainKey: string | null;
  /** Повод, по которому приходит, или null. */
  trigger: string | null;
  /** Признаки, по которым узнаёшь, или null. */
  symptoms: string | null;
  /** Насколько давит, 1..5 — самооценка на сегодня. */
  intensity: number;
  /** Активно ли (`false` = в архиве). */
  isActive: boolean;
  /** Стартовый пример (ADR-0051) — бейдж «пример», инертен до «Добавить себе». */
  isStarter: boolean;
  /** Ручной порядок (ADR-0054). */
  position: number;
  /** Сколько заготовлено ответов — вычисляется на чтение (ADR-0052), не хранится. */
  counterplaysCount: number;
  /** Сколько раз мешал за последние 30 дней — вычисляется на чтение, не хранится. */
  encountersLast30: number;
  /** Когда создано (ISO). */
  createdAt: string;
}

/**
 * Проецирует доменное препятствие наружу (скрывает `accountId`/`version`).
 * @param full Доменная сущность.
 * @param counterplaysCount Число контрмер (посчитано на чтение; 0 если не передано).
 * @param encountersLast30 Столкновений за 30 дней (посчитано на чтение; 0 если не передано).
 * @returns Проекция наружу.
 */
export function toObstacleView(
  full: ObstacleFull,
  counterplaysCount = 0,
  encountersLast30 = 0,
): ObstacleView {
  return {
    id: full.id,
    name: full.name,
    type: full.type,
    domainKey: full.domainKey,
    trigger: full.trigger,
    symptoms: full.symptoms,
    intensity: full.intensity,
    isActive: full.isActive,
    isStarter: full.isStarter,
    position: full.position,
    counterplaysCount,
    encountersLast30,
    createdAt: full.createdAt.toISOString(),
  };
}

/**
 * Страница списка препятствий. Обёртка (а не голый массив) нужна из-за `softLimitExceeded`:
 * это свойство **всего списка**, а не отдельной карточки — дублировать флаг в каждом элементе
 * было бы враньём о его природе. Прецедент обёртки в проекте есть (`{ items, nextCursor }`).
 */
export interface ObstacleListView {
  /** Препятствия в ручном порядке (ADR-0054). */
  items: ObstacleView[];
  /**
   * Активных больше мягкого порога `ACCENT_OBSTACLE_SOFT_LIMIT` (ADR-0062 п.8) → фронт покажет
   * подсказку «много фронтов сразу — может, часть в архив?». **Создание при этом не блокируется.**
   */
  softLimitExceeded: boolean;
}
