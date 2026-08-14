import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OnApplicationBootstrap } from '@nestjs/common';
import type { Env } from './env.schema';

/**
 * Сводка готовности внешних связок при старте (2.9.3·28).
 *
 * **Зачем.** Семь переменных `TELEGRAM_*` имеют пустое умолчание, и до 14.08.2026 приложение
 * молчало о том, что настроено наполовину. Цена молчания измерена дважды за один день: пустой
 * `TELEGRAM_WEBHOOK_SECRET` превращал вебхук в 404 — бот принимал сообщения и не отвечал ни
 * строчки; переменная с неверным именем (`PUBLIC_URL` вместо `PUBLIC_BASE_URL`) заставила ссылки
 * в постах вести на `localhost`. Оба раза причину искали руками, потому что снаружи всё
 * выглядело здоровым.
 *
 * **Уровни выбраны по смыслу, а не «на всякий случай»:**
 * - `log` — бот выключен целиком (токена нет). Это законный режим: dev работает на логирующем
 *   адаптере, и предупреждать тут не о чем.
 * - `error` — **несогласованность**: токен есть, а секрета вебхука нет. Такая связка не работает
 *   и не может заработать сама; молчать о ней нельзя.
 */
@Injectable()
export class TelegramReadinessReporter implements OnApplicationBootstrap {
  private readonly _logger = new Logger('Readiness');

  /**
   * @param _config Конфиг окружения.
   */
  public constructor(private readonly _config: ConfigService<Env, true>) {}

  /**
   * Печатает сводку готовности.
   * @returns Ничего.
   */
  public onApplicationBootstrap(): void {
    const token = this._config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    const secret = this._config.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
    const username = this._config.get('TELEGRAM_BOT_USERNAME', { infer: true });
    const channel = this._config.get('TELEGRAM_CHANNEL_ID', { infer: true });
    const publicUrl = this._config.get('PUBLIC_BASE_URL', { infer: true });

    if (token === '') {
      this._logger.log(
        `Telegram: бот выключен (токена нет) — вещание идёт в лог. Публичный адрес: ${publicUrl}`,
      );
      return;
    }
    if (secret === '') {
      this._logger.error(
        'Telegram: токен есть, но TELEGRAM_WEBHOOK_SECRET пуст — вебхук будет отдавать 404, ' +
          'и бот не ответит ни на одно сообщение.',
      );
    }
    if (username === '') {
      this._logger.warn(
        'Telegram: TELEGRAM_BOT_USERNAME пуст — публичная страница не покажет ссылку на бота.',
      );
    }
    if (channel === '') {
      this._logger.warn('Telegram: TELEGRAM_CHANNEL_ID пуст — посты о релизах уходить некуда.');
    }
    if (publicUrl.includes('localhost')) {
      this._logger.warn(
        `Telegram: PUBLIC_BASE_URL = ${publicUrl} — ссылки в постах и у бота поведут туда же. ` +
          'На проде это почти наверняка ошибка имени переменной.',
      );
    }
    this._logger.log(
      `Telegram: бот настроен (секрет вебхука ${secret === '' ? 'ПУСТ' : 'есть'}), ` +
        `публичный адрес ${publicUrl}`,
    );
  }
}
