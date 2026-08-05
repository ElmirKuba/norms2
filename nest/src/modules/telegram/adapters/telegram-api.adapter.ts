import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelegramApiPort, TelegramButton } from './telegram-api.port';
import type { Env } from '../../../system/config/env.schema';

/**
 * Сколько раз пробуем при сетевом сбое.
 *
 * Не «на всякий случай»: маршрут до Telegram с РФ-хостинга **мерцает** — замер 05.08.2026 дал
 * 5 успешных попыток из 10 подряд. Без повторов терялось каждое второе сообщение, и терялось
 * молча: предупреждение про личные данные не дошло до человека, а следующий вопрос дошёл.
 */
const SEND_ATTEMPTS = 4;

/** Пауза между попытками (мс), растёт линейно. */
const RETRY_DELAY_MS = 700;

/**
 * Предел на одну попытку.
 *
 * Без него `fetch` ждёт зависшее соединение неприлично долго, и повторы не спасают — они просто
 * не наступают. При мерцающем маршруте (70% успеха на замере 05.08.2026) быстрый провал и
 * повтор надёжнее, чем одна терпеливая попытка.
 */
const ATTEMPT_TIMEOUT_MS = 8000;

/**
 * Пауза.
 * @param ms Миллисекунды.
 * @returns Промис, который разрешится через указанное время.
 */
function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** Что нам нужно от ответа Bot API. */
interface TelegramApiResponse {
  /** Успех. */
  ok: boolean;
  /** Описание ошибки. */
  description?: string;
  /** Параметры ошибки — нас интересует только просьба подождать. */
  parameters?: { retry_after?: number };
  /** Результат (для sendMessage — сообщение). */
  result?: { message_id?: number };
}

/**
 * HTTP-реализация исходящего порта Bot API (2.9.1·9).
 *
 * **Ошибки не бросаются, а гасятся с записью в лог.** Человек заблокировал бота, чат удалён,
 * лимит частоты — это не повод валить обработку апдейта: вебхук обязан ответить 200, иначе
 * Telegram будет слать тот же апдейт снова и снова. `sendMessage` возвращает null — вызывающий
 * решает, важно ему это или нет.
 *
 * ⚠️ В логи попадают **чат и метод, но не текст**: в сообщениях заявителя лежат имя и возраст.
 */
@Injectable()
export class TelegramApiAdapter implements TelegramApiPort {
  private readonly _logger = new Logger('TelegramApi');
  private readonly _token: string;

  /**
   * @param configService Конфиг (токен бота).
   */
  public constructor(configService: ConfigService<Env, true>) {
    this._token = configService.get('TELEGRAM_BOT_TOKEN', { infer: true });
  }

  /**
   * Отправляет сообщение.
   * @param chatId Кому.
   * @param text Текст.
   * @param buttons Кнопки.
   * @returns `message_id` или null.
   */
  public async sendMessage(
    chatId: string,
    text: string,
    buttons?: TelegramButton[][],
  ): Promise<number | null> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    };
    if (buttons !== undefined && buttons.length > 0) {
      body['reply_markup'] = {
        inline_keyboard: buttons.map((row) =>
          row.map((button) => ({ text: button.text, callback_data: button.callbackData })),
        ),
      };
    }
    const response = await this._call('sendMessage', body);
    return response?.result?.message_id ?? null;
  }

  /**
   * Гасит «часики» на кнопке.
   * @param callbackQueryId Идентификатор нажатия.
   * @param text Подсказка.
   * @returns Промис завершения.
   */
  public async answerCallback(callbackQueryId: string, text?: string): Promise<void> {
    await this._call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text === undefined ? {} : { text }),
    });
  }

  /**
   * Пересылает сообщение.
   * @param toChatId Кому.
   * @param fromChatId Откуда.
   * @param messageId Что.
   * @returns Промис завершения.
   */
  public async forwardMessage(
    toChatId: string,
    fromChatId: string,
    messageId: number,
  ): Promise<void> {
    await this._call('forwardMessage', {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
  }

  /**
   * Зовёт Bot API, гася ошибки.
   * @param method Метод.
   * @param body Тело.
   * @returns Ответ или null.
   */
  /**
   * Задаёт список команд в меню Telegram.
   * @param commands Команды и описания.
   * @returns Промис завершения.
   */
  public async setCommands(commands: { command: string; description: string }[]): Promise<void> {
    await this._call('setMyCommands', { commands });
  }

  private async _call(
    method: string,
    body: Record<string, unknown>,
  ): Promise<TelegramApiResponse | null> {
    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${this._token}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        });
        const payload = (await response.json()) as TelegramApiResponse;
        if (payload.ok) {
          return payload;
        }
        // Telegram ОТВЕТИЛ отказом — повтор не поможет: разметка битая, бот не админ,
        // чат не найден. Единственное исключение — просьба подождать.
        const retryAfter = payload.parameters?.retry_after;
        if (retryAfter === undefined) {
          this._logger.warn(`${method} отклонён: ${payload.description ?? 'без описания'}`);
          return null;
        }
        await delay((retryAfter + 1) * 1000);
      } catch (error) {
        // Сюда попадаем при сетевом сбое — то самое мерцание маршрута. Пробуем ещё.
        if (attempt === SEND_ATTEMPTS) {
          this._logger.warn(`${method} не отправлен за ${String(attempt)} попыток: ${String(error)}`);
          return null;
        }
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
    return null;
  }
}
