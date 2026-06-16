/**
 * AccentAttributeFull — справочник RPG-атрибутов «Акцента» (каталог `Attribute`,
 * ADR-0028; ADR-0033). PK = `key` (slug, напр. `strength`) — каталог, не сущность
 * (как `Achievement.code`). Цели/привычки прокачивают 0..N атрибутов (по ключам)
 * → «паучья диаграмма» баланса.
 */
export interface AccentAttributeFull {
  /** PK — slug атрибута (`strength`, `discipline`, `intellect`, …). */
  key: string;
  /** Отображаемое название (RU). */
  title: string;
  /** Порядок в списках (ASC). */
  position: number;
  /** Активен ли (мягкое отключение из выдачи). */
  isActive: boolean;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}
