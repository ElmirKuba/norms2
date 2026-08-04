/**
 * Мини-рендер **ограниченного** Markdown → безопасный HTML, без внешних библиотек (F5.6,
 * расширен в 2.9·11).
 *
 * ## Что поддержано — это ЗАКРЫТЫЙ список, а не «пока не всё»
 *
 * | Конструкция | Пример |
 * |---|---|
 * | заголовки 1–3 уровня | `# `, `## `, `### ` |
 * | абзацы | пустая строка разделяет |
 * | маркированные списки, **один уровень вложенности** | `- пункт`, два пробела → `  - подпункт` |
 * | нумерованные списки | `1. пункт` |
 * | цитаты | `> текст` |
 * | таблицы GFM | `\| a \| b \|` + строка-разделитель `\|---\|---\|` |
 * | разделитель | `---` |
 * | жирный / курсив | `**жирный**`, `*курсив*` |
 * | инлайн-код | обратные кавычки вокруг фрагмента |
 * | ссылки | `[текст](url)` |
 *
 * ## Чего НЕТ и не будет (осознанно)
 *
 * Картинки, сырой HTML, блоки кода в тройных кавычках, заголовки глубже `###`, зачёркивание,
 * чекбоксы, сноски, вложенность глубже одного уровня. Автор ноты должен знать границу: релиз-
 * нота — это короткий текст для человека, а не техдокументация. Понадобится больше — сначала решаем,
 * правда ли ноте это нужно, и только потом трогаем парсер.
 *
 * ## Почему своё, а не библиотека (реш. Elmir, 2026-08-04)
 *
 * `marked` (~35 КБ) или `markdown-it` (~100 КБ) **плюс обязательный `DOMPurify`** (~20 КБ):
 * готовые парсеры отдают HTML как есть, и без санитайзера это дыра. Здесь щит устроен иначе и
 * прочнее: **сначала экранируем ВСЁ**, потом накладываем разметку на уже безопасный текст —
 * пользовательский ввод не может породить тег в принципе. Результат биндится через
 * `[innerHTML]`, Angular санитайзит ещё раз.
 */

/** Экранирует HTML-спецсимволы. */
function escapeHtml(source: string): string {
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Инлайновая разметка поверх уже экранированной строки.
 *
 * Порядок важен: **код идёт первым** и его содержимое дальше не трогается — иначе `*` внутри
 * фрагмента кода превратился бы в курсив. Ссылки до жирного/курсива по той же причине: `*` в
 * URL не должен ломать ссылку.
 */
function renderInline(text: string): string {
  // Куски кода вынимаем из текста и подставляем обратно в самом конце. Плейсхолдер — на
  // управляющем символе, а не на слове: обычный текст его не содержит, а из ввода после
  // escapeHtml он появиться не может — подмена не съест чужой фрагмент.
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    const safeUrl = /^(https?:\/\/|\/)/.test(url) ? url : '#';
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');

  return out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => {
    const code = codes[Number(index)] ?? '';
    return `<code>${code}</code>`;
  });
}

/** Разбирает строку таблицы `| a | b |` на ячейки. */
function tableCells(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Строка-разделитель шапки таблицы: `|---|:--:|` и т.п. */
function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');
}

/** Пункт списка: маркер, текст и уровень вложенности (0 или 1). */
interface ListItem {
  ordered: boolean;
  depth: 0 | 1;
  text: string;
}

/** Разбирает строку как пункт списка или отдаёт null. */
function parseListItem(line: string): ListItem | null {
  const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
  if (bullet) {
    return {
      ordered: false,
      depth: (bullet[1] ?? '').length >= 2 ? 1 : 0,
      text: bullet[2] ?? '',
    };
  }
  const numbered = /^(\s*)\d+\.\s+(.*)$/.exec(line);
  if (numbered) {
    return {
      ordered: true,
      depth: (numbered[1] ?? '').length >= 2 ? 1 : 0,
      text: numbered[2] ?? '',
    };
  }
  return null;
}

/**
 * Собирает HTML списка из накопленных пунктов. Вложенность ровно одна: подпункты уходят в
 * `<ul>`/`<ol>` внутри последнего `<li>` — глубже мы не поддерживаем сознательно.
 */
function renderList(items: readonly ListItem[]): string {
  if (items.length === 0) {
    return '';
  }
  const tag = items[0]?.ordered === true ? 'ol' : 'ul';
  let html = `<${tag}>`;
  let open = false;
  let nested: string[] = [];
  let nestedTag = 'ul';

  const closeNested = (): void => {
    if (nested.length > 0) {
      html += `<${nestedTag}>${nested.join('')}</${nestedTag}>`;
      nested = [];
    }
  };

  for (const item of items) {
    if (item.depth === 1) {
      nestedTag = item.ordered ? 'ol' : 'ul';
      nested.push(`<li>${renderInline(item.text)}</li>`);
      continue;
    }
    if (open) {
      closeNested();
      html += '</li>';
    }
    html += `<li>${renderInline(item.text)}`;
    open = true;
  }
  if (open) {
    closeNested();
    html += '</li>';
  }
  return `${html}</${tag}>`;
}

/**
 * Рендерит ограниченный Markdown в HTML-строку.
 * @param source Исходный текст (Markdown или просто текст).
 * @returns HTML-строка для `[innerHTML]`.
 */
export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let list: ListItem[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushList = (): void => {
    if (list.length > 0) {
      blocks.push(renderList(list));
      list = [];
    }
  };
  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushQuote = (): void => {
    if (quote.length > 0) {
      blocks.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = (): void => {
    flushList();
    flushParagraph();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] ?? '').trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = parseListItem(line);
    const rule = /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
    // Ищем `&gt;`, а не `>`: экранирование идёт ПЕРЕД разбором блоков (в этом весь XSS-щит),
    // поэтому к моменту проверки маркер цитаты уже экранирован. Ловилось живым прогоном —
    // регулярка на сырой `>` не срабатывала никогда.
    const quoted = /^&gt;\s?(.*)$/.exec(line);

    // Таблица: строка с трубами, за которой идёт разделитель. Проверяем ДО списков — иначе
    // ячейка, начинающаяся с дефиса, утащила бы строку в список.
    if (line.trim().startsWith('|') && isTableDivider(lines[index + 1] ?? '')) {
      flushAll();
      const header = tableCells(line);
      const rows: string[] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        const cells = tableCells(lines[index] ?? '');
        rows.push(`<tr>${cells.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`);
        index++;
      }
      index--;
      blocks.push(
        `<table><thead><tr>${header
          .map((cell) => `<th>${renderInline(cell)}</th>`)
          .join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`,
      );
      continue;
    }

    if (rule) {
      flushAll();
      blocks.push('<hr>');
    } else if (heading) {
      flushAll();
      const level = (heading[1] ?? '').length;
      blocks.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
    } else if (quoted) {
      flushList();
      flushParagraph();
      quote.push(quoted[1] ?? '');
    } else if (item) {
      flushParagraph();
      flushQuote();
      list.push(item);
    } else if (line.trim() === '') {
      flushAll();
    } else {
      flushList();
      flushQuote();
      paragraph.push(line);
    }
  }
  flushAll();
  return blocks.join('\n');
}
