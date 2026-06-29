import type {
  MicroWinCategory,
  MicroWinFull,
  UserState,
} from './micro-win-full.interface';

/**
 * MicroWinView — проекция микро-победы наружу (CRUD-эндпоинты). Без `accountId`/
 * `isActive`/таймстампов (служебное). `completedToday` — выполнена ли сегодня
 * (для дневного фидбэка на UI); реальное вычисление по логам — подфаза 2.2·4.
 */
export interface MicroWinView {
  /** Идентификатор. */
  id: string;
  /** Название действия. */
  title: string;
  /** Категория нагрузки (ось модальности). */
  category: MicroWinCategory;
  /** Сфера жизни (мягкий ключ, опц.; ось M#B3-1) или null. */
  domainKey: string | null;
  /** Длительность действия в секундах. */
  durationSeconds: number;
  /** Время на подготовку в секундах (опц.; null = без подготовки). */
  prepSeconds: number | null;
  /** Цена энергии 1..3. */
  energyCost: number;
  /** Ожидаемый эффект или null. */
  effect: string | null;
  /** Состояния, в которых скрывать, или null. */
  disabledForStates: UserState[] | null;
  /** Выполнена ли сегодня (дневной лимит/фидбэк). */
  completedToday: boolean;
  /** Стартовая (пример из пака), ещё не присвоена — для badge «пример» (2.3). */
  isStarter: boolean;
}

/**
 * Проецирует доменную микро-победу в наружную view.
 * @param full Доменная сущность.
 * @param completedToday Выполнена ли сегодня (по логам; 2.2·4).
 * @returns Проекция наружу.
 */
export function toMicroWinView(full: MicroWinFull, completedToday: boolean): MicroWinView {
  return {
    id: full.id,
    title: full.title,
    category: full.category,
    domainKey: full.domainKey,
    durationSeconds: full.durationSeconds,
    prepSeconds: full.prepSeconds,
    energyCost: full.energyCost,
    effect: full.effect,
    disabledForStates: full.disabledForStates,
    completedToday,
    isStarter: full.isStarter,
  };
}
