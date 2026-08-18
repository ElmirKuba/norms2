import { buildReleaseCaption } from './release-post.util';

/**
 * Сборка подписи к посту о релизе.
 *
 * Проверка появилась после живого промаха (18.08.2026): в первом же публичном анонсе строка с
 * ботом вышла как `norms2_bot` — без собачки Telegram не делает ссылку, и Elmir дописывал её
 * руками. В `.env` юзернейм лежит голым намеренно (таким его ждёт Telegram API), значит
 * приводить к виду `@name` обязан тот, кто пишет текст для людей.
 */
describe('подпись к посту о релизе', () => {
  const markdown = '# Заголовок\n\nЛид одной строкой.\n\n## Первый тезис\n\n## Второй тезис\n';

  it('дописывает собачку юзернейму бота', () => {
    const caption = buildReleaseCaption({
      title: 'Выпуск',
      markdown,
      url: 'https://example.org/releases/release-1.0.0',
      botUsername: 'norms2_bot',
    });
    expect(caption).toContain('@norms2_bot');
    expect(caption).not.toContain(' norms2_bot');
  });

  it('не удваивает собачку, если она уже есть', () => {
    const caption = buildReleaseCaption({
      title: 'Выпуск',
      markdown,
      url: 'https://example.org/releases/release-1.0.0',
      botUsername: '@norms2_bot',
    });
    expect(caption).toContain('@norms2_bot');
    expect(caption).not.toContain('@@');
  });

  it('без юзернейма строки про заявку нет вовсе', () => {
    const caption = buildReleaseCaption({
      title: 'Выпуск',
      markdown,
      url: 'https://example.org/releases/release-1.0.0',
      botUsername: null,
    });
    expect(caption).not.toContain('Заявка боту');
  });

  it('берёт лид и тезисы из ноты', () => {
    const caption = buildReleaseCaption({
      title: 'Выпуск',
      markdown,
      url: 'https://example.org/releases/release-1.0.0',
      botUsername: null,
    });
    expect(caption).toContain('Лид одной строкой.');
    expect(caption).toContain('Первый тезис');
    expect(caption).toContain('Второй тезис');
  });
});
