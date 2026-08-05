import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReleaseAnnouncement, ReleaseBroadcastPort } from './release-broadcast.port';
import { buildReleaseCaption } from './release-post.util';
import type { Env } from '../../../system/config/env.schema';

/** Папка с превью релизов внутри `seed-content/` (едет в образ вместе с нотами). */
const PREVIEW_DIR = 'seed-content/notifications/previews';

/** Сколько раз повторяем отправку после `429 retry_after`. */
const RETRY_LIMIT = 1;

/** Форма ответа Telegram, которая нас интересует. */
interface TelegramResponse {
  /** Признак успеха. */
  ok: boolean;
  /** Текст ошибки. */
  description?: string;
  /** Параметры ошибки (в т.ч. `retry_after`). */
  parameters?: { retry_after?: number };
}

/**
 * Вещание релизов в Telegram-канал (2.9.1·5).
 *
 * Пост — **одно сообщение**: превью картинкой, в подписи заголовок, лид, тезисы и ссылка на
 * публичную витрину ([ADR-0064 §6](../../../../docs/decisions/0064-telegram-release-channel.md)).
 * Полный текст в канал не уходит: он обессмыслил бы ссылку и занял бы четыре сообщения подряд.
 *
 * **Ошибки доставки глушатся.** Бот исключён из админов, Telegram недоступен, лимит частоты —
 * это не повод валить старт приложения: нота уже в БД и уже видна в колокольчике. Метод
 * возвращает `false`, отметка `broadcastedAt` не ставится, и следующая попытка произойдёт при
 * следующем старте — сама, без ручного вмешательства.
 *
 * **Нет превью — пост всё равно уходит**, текстом. Релиз состоялся; молчать о нём из-за
 * ненарисованной картинки было бы хуже, чем пост без картинки.
 */
@Injectable()
export class TelegramReleaseBroadcastAdapter implements ReleaseBroadcastPort {
  private readonly _logger = new Logger('ReleaseBroadcast');
  private readonly _token: string;
  private readonly _chatId: string;
  private readonly _baseUrl: string;
  private readonly _botUsername: string;
  private readonly _contentDir: string;

  /**
   * @param configService Конфиг (токен, канал, публичный адрес).
   */
  public constructor(configService: ConfigService<Env, true>) {
    this._token = configService.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this._chatId = configService.get('TELEGRAM_CHANNEL_ID', { infer: true });
    this._baseUrl = configService.get('PUBLIC_BASE_URL', { infer: true }).replace(/\/+$/, '');
    this._botUsername = configService.get('TELEGRAM_BOT_USERNAME', { infer: true });
    this._contentDir = resolve(configService.get('CONTENT_DIR', { infer: true }));
  }

  /**
   * Публикует пост о релизе в канал.
   * @param announcement Что объявляем.
   * @returns `true`, если Telegram принял сообщение.
   */
  public async announce(announcement: ReleaseAnnouncement): Promise<boolean> {
    if (this._chatId === '') {
      this._logger.warn(`TELEGRAM_CHANNEL_ID пуст — «${announcement.key}» в канал не ушёл.`);
      return false;
    }
    try {
      // Нота-страница: файла нет, тезисы собирать не из чего — остаются заголовок и ссылка.
      const markdown =
        announcement.contentFile === null
          ? ''
          : await readFile(join(this._contentDir, announcement.contentFile), 'utf8');
      const caption = buildReleaseCaption({
        title: announcement.title,
        markdown,
        url: `${this._baseUrl}/releases/${announcement.key}`,
        botUsername: this._botUsername === '' ? null : this._botUsername,
      });
      const preview = await this._readPreview(announcement.key);
      return preview === null
        ? await this._sendMessage(caption)
        : await this._sendPhoto(caption, preview, announcement.key);
    } catch (error) {
      this._logger.warn(`Пост о «${announcement.key}» не ушёл: ${String(error)}`);
      return false;
    }
  }

  /**
   * Читает превью релиза, если оно нарисовано.
   * @param key Ключ ноты.
   * @returns Содержимое png или null.
   */
  private async _readPreview(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolve(process.cwd(), PREVIEW_DIR, `${key}.png`));
    } catch {
      this._logger.warn(`Превью для «${key}» нет — пост уйдёт текстом.`);
      return null;
    }
  }

  /**
   * Отправляет фото с подписью.
   * @param caption Подпись.
   * @param preview Картинка.
   * @param key Ключ ноты (для имени файла и логов).
   * @returns Признак успеха.
   */
  private async _sendPhoto(caption: string, preview: Buffer, key: string): Promise<boolean> {
    const form = new FormData();
    form.append('chat_id', this._chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([new Uint8Array(preview)], { type: 'image/png' }), `${key}.png`);
    return this._call('sendPhoto', form);
  }

  /**
   * Отправляет текстовое сообщение (когда превью нет).
   * @param caption Текст поста.
   * @returns Признак успеха.
   */
  private async _sendMessage(caption: string): Promise<boolean> {
    const form = new FormData();
    form.append('chat_id', this._chatId);
    form.append('text', caption);
    form.append('parse_mode', 'HTML');
    // Ссылка на витрину и так в тексте; развёрнутое превью страницы дублировало бы картинку.
    form.append('disable_web_page_preview', 'true');
    return this._call('sendMessage', form);
  }

  /**
   * Зовёт Bot API, один раз повторяя при `429 retry_after`.
   * @param method Метод Bot API.
   * @param form Тело запроса.
   * @param attempt Номер попытки.
   * @returns Признак успеха.
   */
  private async _call(method: string, form: FormData, attempt = 0): Promise<boolean> {
    const response = await fetch(`https://api.telegram.org/bot${this._token}/${method}`, {
      method: 'POST',
      body: form,
      // Тот же предел, что у диалогового адаптера: зависшее соединение блокирует старт
      // приложения, ведь сид объявляет релизы при загрузке.
      signal: AbortSignal.timeout(20000),
    });
    const payload = (await response.json()) as TelegramResponse;
    if (payload.ok) {
      return true;
    }
    const retryAfter = payload.parameters?.retry_after;
    if (retryAfter !== undefined && attempt < RETRY_LIMIT) {
      // Лимит частоты — единственная ошибка, которую имеет смысл переждать: остальные
      // (бот не админ, канал не найден, битая разметка) от повтора не исправятся.
      this._logger.warn(`Telegram просит подождать ${retryAfter} с — повторяю один раз.`);
      await new Promise((done) => setTimeout(done, (retryAfter + 1) * 1000));
      return this._call(method, form, attempt + 1);
    }
    this._logger.warn(`Telegram отклонил ${method}: ${payload.description ?? 'без описания'}`);
    return false;
  }
}
