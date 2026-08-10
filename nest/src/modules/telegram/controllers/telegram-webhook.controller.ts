import { Body, Controller, Headers, HttpCode, Logger, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleTelegramUpdateUseCase } from '../use-cases/handle-telegram-update.use-case';
import type { TelegramUpdate } from '../interfaces/telegram-update.interface';
import type { Env } from '../../../system/config/env.schema';
import {
  SETTING_TELEGRAM_BOT_PAUSED,
  SettingsDomainService,
} from '../../settings/domain-services/settings.domain-service';

/** Заголовок, которым Telegram подтверждает, что апдейт от него. */
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Вебхук бота (`POST /api/v1/telegram/webhook`, 2.9.1·9).
 *
 * **Guard здесь не подходит принципиально:** запрос приходит не от нашего пользователя, у него
 * нет ни сессии, ни JWT. Подлинность подтверждает секретный заголовок, который Telegram шлёт с
 * каждым апдейтом, — его значение задаётся при `setWebhook` и лежит в `.env`.
 *
 * **Пустой `TELEGRAM_WEBHOOK_SECRET` = ручки нет** (404), а не «принимаем всех». Открытый
 * вебхук у бота, который умеет выдавать приглашения, — это раздача приглашений кому угодно;
 * забытая переменная не должна превращаться в дыру.
 *
 * **Всегда отвечаем 200 после проверки.** Любая ошибка внутри — и Telegram будет повторять тот
 * же апдейт снова и снова; повтор мы и так отсекаем, но заваливать себя нет смысла.
 *
 * ⚠️ **Тело апдейта не логируется** ([ADR-0064 §10](../../../../docs/decisions/0064-telegram-release-channel.md)).
 */
@Controller('telegram')
export class TelegramWebhookController {
  private readonly _logger = new Logger('TelegramWebhook');
  private readonly _secret: string;

  /**
   * @param _handleTelegramUpdateUseCase Обработчик апдейта.
   * @param configService Конфиг (секрет вебхука).
   * @param _settings Рантайм-настройки: пауза (2.9.3·4).
   */
  public constructor(
    private readonly _handleTelegramUpdateUseCase: HandleTelegramUpdateUseCase,
    configService: ConfigService<Env, true>,
    private readonly _settings: SettingsDomainService,
  ) {
    this._secret = configService.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
  }

  /**
   * Принимает апдейт от Telegram.
   * @param secret Значение секретного заголовка.
   * @param update Тело апдейта.
   * @returns Пустой ответ 200.
   * @throws {NotFoundException} Если вебхук не настроен (секрет пуст).
   * @throws {UnauthorizedException} Если секрет не совпал.
   */
  @Post('webhook')
  @HttpCode(200)
  public async webhook(
    @Headers(SECRET_HEADER) secret: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<void> {
    if (this._secret === '') {
      throw new NotFoundException();
    }
    if (secret !== this._secret) {
      // Логируем факт, но не тело: у попытки подбора нет полезного содержимого.
      this._logger.warn('Апдейт с неверным секретом отклонён.');
      throw new UnauthorizedException();
    }
    // Пауза (2.9.3) закрывает и ВХОДЯЩЕЕ, не только ответы: иначе бот молча менял бы
    // состояние (принимал заявки, начислял приглашения), а человек не получал ни строчки —
    // это хуже, чем не работать вовсе.
    //
    // Отвечаем 200 и роняем апдейт. Отказ заставил бы Telegram повторять его сутки, и после
    // снятия паузы всё накопленное приехало бы лавиной. Цена решения принята осознанно:
    // написанное боту во время паузы теряется.
    if (this._settings.getBoolean(SETTING_TELEGRAM_BOT_PAUSED)) {
      this._logger.log('Бот на паузе — апдейт принят и не обработан.');
      return;
    }
    try {
      await this._handleTelegramUpdateUseCase.execute(update);
    } catch (error) {
      // Сообщение об ошибке — да, апдейт — нет.
      this._logger.error(`Обработка апдейта сорвалась: ${String(error)}`);
    }
  }
}
