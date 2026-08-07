import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import type { OnApplicationBootstrap } from '@nestjs/common';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { Env } from '../../../system/config/env.schema';

/**
 * Меню команд бота — **единственный источник правды, и он в коде**.
 *
 * Раньше список жил в BotFather и разъезжался с обработчиками: команду `/link` переписали на
 * одноразовые коды, а подсказка в меню ещё сутки предлагала «/link логин» (поймано 05.08.2026).
 * Теперь описания лежат рядом с кодом, который их исполняет, и у стейджевого с боевым ботом они
 * совпадают без ручной сверки.
 */
const COMMANDS: { command: string; description: string }[] = [
  // У /start и /menu было одинаковое описание «Меню» — в списке Telegram это две строки,
  // различающиеся только командой, и читается как ошибка. /start — первая команда в жизни
  // чата, она про вход, а не про меню (замечено Elmir 05.08.2026).
  { command: 'start', description: 'Начать' },
  { command: 'menu', description: 'Меню' },
  { command: 'link', description: 'Привязать аккаунт кодом из личного кабинета' },
  { command: 'unlink', description: 'Отвязать этот чат от аккаунта' },
  { command: 'cancel', description: 'Прервать заполнение' },
];

/**
 * Публикует меню команд при старте приложения (2.9.1).
 *
 * Ошибку глушим и логируем: Telegram может быть недоступен (маршрут до него мерцает), но
 * приложение из-за неудавшейся косметики стартовать обязано.
 */
@Injectable()
export class BotCommandsInitializer implements OnApplicationBootstrap {
  private readonly _logger = new Logger('TelegramCommands');
  private readonly _enabled: boolean;

  /**
   * @param _api Исходящий порт Bot API.
   * @param configService Конфиг (пустой токен — бота нет, публиковать нечего).
   */
  public constructor(
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    configService: ConfigService<Env, true>,
  ) {
    this._enabled = configService.get('TELEGRAM_BOT_TOKEN', { infer: true }) !== '';
  }

  /**
   * Публикует список команд.
   * @returns Промис завершения.
   */
  public async onApplicationBootstrap(): Promise<void> {
    if (!this._enabled) {
      return;
    }
    try {
      await this._api.setCommands(COMMANDS);
      this._logger.log(`Меню команд бота обновлено (${String(COMMANDS.length)}).`);
    } catch (error) {
      this._logger.warn(`Не удалось обновить меню команд: ${String(error)}`);
    }
  }
}
