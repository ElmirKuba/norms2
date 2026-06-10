/**
 * Мини-рендер ограниченного Markdown → безопасный HTML (без внешних либ, F5.6).
 * Поддержка: заголовки `#`/`##`/`###`, списки `-`/`*`, разделитель `---`, абзацы,
 * `**жирный**`, `*курсив*`, ссылки `[текст](url)`. Сначала экранируем ВСЁ (XSS-щит), затем
 * накладываем разметку — пользовательский текст не может породить теги. Результат
 * биндится через `[innerHTML]`; Angular дополнительно санитайзит.
 */

/** Экранирует HTML-спецсимволы. */
function escapeHtml(source: string): string {
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Инлайновая разметка (ссылки → жирный → курсив) поверх уже экранированной строки. */
function renderInline(text: string): string {
  let out = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    const safeUrl = /^(https?:\/\/|\/)/.test(url) ? url : '#';
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  return out;
}

/**
 * Рендерит ограниченный Markdown в HTML-строку.
 * @param source Исходный текст (Markdown или просто текст).
 * @returns HTML-строка для `[innerHTML]`.
 */
export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  const flushList = (): void => {
    if (list.length > 0) {
      blocks.push(`<ul>${list.join('')}</ul>`);
      list = [];
    }
  };
  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^[-*]\s+(.*)$/.exec(line);
    const rule = /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());

    if (rule) {
      flushList();
      flushParagraph();
      blocks.push('<hr>');
    } else if (heading) {
      flushList();
      flushParagraph();
      const level = (heading[1] ?? '').length;
      blocks.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
    } else if (item) {
      flushParagraph();
      list.push(`<li>${renderInline(item[1] ?? '')}</li>`);
    } else if (line.trim() === '') {
      flushList();
      flushParagraph();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushList();
  flushParagraph();
  return blocks.join('\n');
}
