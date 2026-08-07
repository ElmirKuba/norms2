/**
 * Реестр порталов-лендингов релизов (2.9.2·4; переведён с Angular-компонентов на портал 2026-08-07).
 *
 * **Почему портал (iframe), а не Angular-компонент.** Лендинг — самодостаточный документ со
 * своими стилями, скриптом и прокруткой. Внутри Angular он ломался: `ViewEncapsulation.None`
 * сталкивал глобальные стили двух компонентов (один `.pet` перекрывал другой), `ngComponentOutlet`
 * сбивал тайминг хуков, а прокрутку слушало не то окно — «коты не ехали». В отдельном документе
 * всё это исчезает: свой `window`, свой скролл, своя изоляция. Тот же лендинг, что не двигался как
 * набор компонентов, в портале работает как есть.
 *
 * `<iframe>` — актуальный элемент (устарели `<frame>`/`<frameset>`, а экспериментальный `<portal>`
 * Chrome свернул). Для встраивания самодостаточного документа iframe — верный инструмент.
 *
 * **Где лежат файлы.** `angular/public/releases/<key>.html` — отдаются статикой в корень сайта
 * (`/releases/<key>.html`). Источник правды по вёрстке — полигон `~/coding/landing-lab/<N>`;
 * сюда кладётся его собранный `index.html`. Изменился полигон — перекопировать файл.
 *
 * @example
 * ```ts
 * export const RELEASE_PORTALS: ReleasePortals = {
 *   'release-2.0.0': '/releases/release-2.0.0.html',
 * };
 * ```
 */
export type ReleasePortals = Record<string, string>;

/** Пути к порталам-лендингам по ключу ноты (внутри `public/`). */
export const RELEASE_PORTALS: ReleasePortals = {
  'release-2.0.0': '/releases/release-2.0.0.html',
};

/**
 * Находит путь к порталу релиза по ключу.
 *
 * @param key Ключ ноты (`release-2.0.0`).
 * @returns Путь к статическому HTML или null, если портала для ключа нет.
 */
export function releasePortalUrl(key: string): string | null {
  return RELEASE_PORTALS[key] ?? null;
}
