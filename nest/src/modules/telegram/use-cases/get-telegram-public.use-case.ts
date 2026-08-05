import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../system/config/env.schema';
import type { TelegramPublicView } from '../interfaces/telegram-public-view.interface';

/**
 * Публичные строки Telegram-области (2.9.1·13-ссылки): имя бота и ссылка на него.
 *
 * **Ручка своей области, а не общий `public-config`.** Агрегатор публичных строк из разных
 * областей понадобится, когда таких строк станет много; сейчас она одна, и собирать нечего —
 * зато границы модулей остаются целы.
 */
@Injectable()
export class GetTelegramPublicUseCase {
  private readonly _view: TelegramPublicView;

  /**
   * @param configService Конфиг (имя бота и ссылка).
   */
  public constructor(configService: ConfigService<Env, true>) {
    const botUsername = configService.get('TELEGRAM_BOT_USERNAME', { infer: true }).replace(/^@/, '');
    const configured = configService.get('TELEGRAM_BOT_URL', { infer: true }).trim();
    // Ссылка задаётся отдельно, потому что адрес не всегда `t.me/<имя>`: бывает deeplink с
    // параметром или другой хост. Не задана — собираем из имени; нет и имени — бот на этом
    // стенде не настроен, и экран честно скажет об этом вместо битой ссылки.
    const botUrl = configured !== '' ? configured : botUsername === '' ? '' : `https://t.me/${botUsername}`;
    const channelUrl = configService.get('TELEGRAM_CHANNEL_URL', { infer: true }).trim();
    this._view = { botUsername, botUrl, channelUrl };
  }

  /**
   * Отдаёт публичные строки.
   * @returns Имя бота и ссылка.
   */
  public execute(): TelegramPublicView {
    return this._view;
  }
}
