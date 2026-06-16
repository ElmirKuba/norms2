/** Запись сид-справочника: ключ-slug, название (RU), порядок. */
export interface AccentRefSeed {
  key: string;
  title: string;
  position: number;
}

/**
 * Дефолтные сферы жизни (каталог `DomainKey`, domain-model §1). Сид гарантирует их
 * наличие на старте (ON CONFLICT по `key` — не плодит дублей, не перетирает правки).
 */
export const DEFAULT_DOMAINS: readonly AccentRefSeed[] = [
  { key: 'health', title: 'Здоровье', position: 1 },
  { key: 'sleep', title: 'Сон', position: 2 },
  { key: 'sport', title: 'Спорт', position: 3 },
  { key: 'work', title: 'Работа', position: 4 },
  { key: 'money', title: 'Деньги', position: 5 },
  { key: 'relationships', title: 'Отношения', position: 6 },
  { key: 'learning', title: 'Обучение', position: 7 },
  { key: 'home', title: 'Дом', position: 8 },
  { key: 'creativity', title: 'Творчество', position: 9 },
  { key: 'purpose', title: 'Смысл', position: 10 },
];

/** Дефолтные RPG-атрибуты (каталог `Attribute`, ADR-0028 / domain-model §1). */
export const DEFAULT_ATTRIBUTES: readonly AccentRefSeed[] = [
  { key: 'strength', title: 'Сила', position: 1 },
  { key: 'discipline', title: 'Дисциплина', position: 2 },
  { key: 'intellect', title: 'Интеллект', position: 3 },
  { key: 'spirit', title: 'Дух', position: 4 },
  { key: 'social', title: 'Социальность', position: 5 },
  { key: 'health', title: 'Здоровье', position: 6 },
];
