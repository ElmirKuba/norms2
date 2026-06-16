/**
 * AccentRefItem — элемент справочника наружу (сфера или атрибут): ключ + название.
 * Проекция для клиента — без `position`/`is_active`/меток (нужны только key+title
 * для селекторов целей/привычек).
 */
export interface AccentRefItem {
  /** Slug-ключ (`health`, `strength`, …) — хранится в `domainKey`/`attributes[]`. */
  key: string;
  /** Отображаемое название (RU). */
  title: string;
}
