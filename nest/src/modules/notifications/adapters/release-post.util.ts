/** Лимит подписи к фото в Telegram (символы, не байты). */
export const TELEGRAM_CAPTION_LIMIT = 1024;

/** Сколько тезисов берём в пост максимум. */
const MAX_THESES = 5;

/** Материал для сборки подписи. */
export interface ReleasePostInput {
  /** Заголовок ноты. */
  title: string;
  /** Полный текст ноты (Markdown). */
  markdown: string;
  /** Публичная ссылка на ноту (`https://нормисы.рф/releases/release-2.9.1`). */
  url: string;
  /** Юзернейм бота для строки с заявкой (`@norms2_bot`) или null — тогда строки не будет. */
  botUsername: string | null;
}

/**
 * Экранирует текст под `parse_mode=HTML` Telegram.
 *
 * Экранируются ровно три символа — так требует Telegram, и расширять список нельзя: кавычки и
 * апострофы он ждёт сырыми, а `&quot;` покажет как есть. Наши ноты полны «ёлочек» и тире.
 * @param text Сырой текст.
 * @returns Текст, безопасный для HTML-разметки Telegram.
 */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Вытаскивает лид — первый абзац ноты после заголовка первого уровня.
 * @param markdown Текст ноты.
 * @returns Лид или пустая строка.
 */
function extractLead(markdown: string): string {
  const withoutHeading = markdown.replace(/^\s*#\s+[^\n]*\n+/, '');
  const paragraph = withoutHeading.split(/\n\s*\n/)[0] ?? '';
  // Внутри абзаца могут быть переносы — в подписи они превратились бы в рваные строки.
  return stripInlineMarkdown(paragraph.replace(/\s*\n\s*/g, ' ').trim());
}

/**
 * Убирает разметку, которую Telegram в подписи не покажет или покажет мусором.
 * @param text Фрагмент Markdown.
 * @returns Чистый текст.
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Собирает тезисы из заголовков `##` ноты.
 *
 * **Почему из заголовков, а не из отдельного поля.** Они уже написаны как тезисы («Два числа
 * вместо серии»), их 3–5 на ноту, и они не могут разойтись с текстом — потому что они и есть
 * текст. Отдельное поле пришлось бы синхронизировать руками, а расхождение анонса с нотой
 * никто бы не заметил ([ADR-0064 §6](../../../../docs/decisions/0064-telegram-release-channel.md)).
 * @param markdown Текст ноты.
 * @returns Тезисы, максимум {@link MAX_THESES}.
 */
export function extractTheses(markdown: string): string[] {
  const theses: string[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match?.[1] !== undefined) {
      theses.push(stripInlineMarkdown(match[1]));
    }
  }
  return theses.slice(0, MAX_THESES);
}

/**
 * Обрезает текст по границе слова, добавляя многоточие.
 * @param text Текст.
 * @param limit Предел в символах.
 * @returns Обрезанный текст.
 */
function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Собирает подпись к посту: заголовок, лид, маркированный список тезисов, ссылка на витрину.
 *
 * **Пост — анонс, а не полный текст** (ADR-0064 §6): ноты доходят до 12 600 символов, это 4+
 * сообщения подряд, а главное — полный текст в канале обессмысливает ссылку на витрину, ради
 * которой она и делается.
 *
 * **Как ужимается длинное.** Лимит 1024 жёсткий, и обрезать «что попало» нельзя: если срезать
 * ссылку, пост потеряет смысл. Поэтому части выкидываются в порядке важности — сначала
 * сокращается лид, потом убираются тезисы с конца; заголовок и ссылка остаются всегда.
 *
 * @param input Материал поста.
 * @returns Готовая подпись в разметке HTML Telegram, гарантированно ≤ 1024 символов.
 */
export function buildReleaseCaption(input: ReleasePostInput): string {
  const title = `<b>${escapeTelegramHtml(input.title)}</b>`;
  const link = `Подробнее: ${escapeTelegramHtml(input.url)}`;
  const bot =
    input.botUsername === null
      ? null
      : `Нет приглашения? Заявка боту: ${escapeTelegramHtml(input.botUsername)}`;
  const theses = extractTheses(input.markdown).map(
    (thesis) => `• ${escapeTelegramHtml(thesis)}`,
  );
  const lead = escapeTelegramHtml(extractLead(input.markdown));

  const assemble = (leadText: string, thesisLines: string[]): string =>
    [title, leadText, thesisLines.join('\n'), [link, bot].filter(Boolean).join('\n')]
      .filter((block) => block !== '')
      .join('\n\n');

  let caption = assemble(lead, theses);
  if (caption.length <= TELEGRAM_CAPTION_LIMIT) {
    return caption;
  }

  // 1) Ужимаем лид: он дольше всех терпит сокращение — это вводная фраза, а не факты.
  const overflow = caption.length - TELEGRAM_CAPTION_LIMIT;
  caption = assemble(truncateAtWord(lead, Math.max(0, lead.length - overflow)), theses);

  // 2) Если всё ещё длинно — снимаем тезисы с конца: лучше меньше пунктов, чем оборванный.
  const kept = [...theses];
  while (caption.length > TELEGRAM_CAPTION_LIMIT && kept.length > 0) {
    kept.pop();
    caption = assemble(truncateAtWord(lead, Math.max(0, lead.length - overflow)), kept);
  }

  // 3) Крайний случай (гигантский заголовок): режем целиком, но по границе слова.
  return caption.length <= TELEGRAM_CAPTION_LIMIT
    ? caption
    : truncateAtWord(caption, TELEGRAM_CAPTION_LIMIT);
}
