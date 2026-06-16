/**
 * AccentDomainFull — справочник сфер жизни «Акцента» (каталог `DomainKey`; ADR-0033).
 * PK = `key` (slug, напр. `health`) — это КАТАЛОГ, не сущность, поэтому ключ —
 * slug, а не uuidv7 (прецедент: `Achievement.code` в фазе 1; нюанс к ADR-0016).
 * Цели/привычки ссылаются на сферу строкой-ключом (`domainKey`).
 */
export interface AccentDomainFull {
  /** PK — slug сферы (`health`, `sport`, `work`, …). */
  key: string;
  /** Отображаемое название (RU). */
  title: string;
  /** Порядок в списках (ASC). */
  position: number;
  /** Активна ли (мягкое отключение из выдачи). */
  isActive: boolean;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}
