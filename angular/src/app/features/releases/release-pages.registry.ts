import type { Type } from '@angular/core';

/**
 * Реестр страниц-лендингов релизов (2.9.2·4).
 *
 * **Зачем реестр, а не маршрут на каждую страницу.** Публичный адрес у релиза один и тот же —
 * `/releases/:key`, независимо от формата: ссылка из поста в канале, из колокольчика и из витрины
 * ведёт в одно место. Формат приходит с бэка (`contentFormat`), и если это `page`, деталь релиза
 * подставляет сюда компонент вместо мини-рендера markdown.
 *
 * **Ключ — тот же `key`, что в базе** (`release-2.9.2`). Совпадение обязательное: по нему
 * страница и находится.
 *
 * **Загрузка ленивая.** Лендинг тяжёлый — эффекты, крупная вёрстка, — и он не должен попадать в
 * бандл тем, кто читает текстовые ноты. Пока страниц нет, реестр пуст, и это рабочее состояние:
 * бэк не отдаёт `page` ни для одной ноты (правило «патч — по умолчанию md»).
 *
 * @example
 * ```ts
 * export const RELEASE_PAGES: ReleasePages = {
 *   'release-2.9.2': () => import('./pages/release-2-9-2/release-2-9-2.page').then((m) => m.Release292Page),
 * };
 * ```
 */
export type ReleasePages = Record<string, () => Promise<Type<unknown>>>;

/** Страницы релизов по ключу. Пусто, пока лендинг 2.9.2 не собран (·5). */
export const RELEASE_PAGES: ReleasePages = {};

/**
 * Находит страницу релиза по ключу.
 *
 * @param key Ключ ноты (`release-2.9.2`).
 * @returns Компонент страницы или null, если её нет в реестре.
 */
export async function loadReleasePage(key: string): Promise<Type<unknown> | null> {
  const load = RELEASE_PAGES[key];
  return load === undefined ? null : await load();
}
