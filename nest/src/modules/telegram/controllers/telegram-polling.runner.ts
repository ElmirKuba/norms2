import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import { HandleTelegramUpdateUseCase } from '../use-cases/handle-telegram-update.use-case';
import type { Env } from '../../../system/config/env.schema';
import {
  SETTING_TELEGRAM_BOT_PAUSED,
  SettingsDomainService,
} from '../../settings/domain-services/settings.domain-service';

/**
 * Сколько секунд держать открытым один запрос за апдейтами.
 *
 * 50 — предел, который Telegram принимает без нареканий. Меньше не даёт выигрыша (соединение
 * всё равно переоткрывается), больше — отвергается.
 */
const LONG_POLL_SECONDS = 50;

/** Пауза перед новым кругом после сбоя — чтобы при мёртвой сети не молотить вхолостую. */
const FAILURE_BACKOFF_MS = 3000;

/** Пауза перед новым кругом после успешного круга: соединение переоткрывается сразу. */
const SUCCESS_BACKOFF_MS = 0;

/**
 * Пауза.
 * @param ms Миллисекунды.
 * @returns Промис, который разрешится через указанное время.
 */
function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Второй вход для апдейтов — **мы сами спрашиваем Telegram** (`TELEGRAM_UPDATES_MODE=polling`,
 * 15.08.2026).
 *
 * **Почему это лежит рядом с контроллером, а не в `domain-services`.** Это точка входа, такая
 * же как вебхук: снаружи приходит апдейт, дальше зовётся use-case. Правило потока
 * («controllers → use-cases → domain-services») не нарушается — нарушением было бы обратное,
 * если бы доменный сервис дёргал use-case.
 *
 * **Зачем режим появился.** 15.08.2026 маршрут между Telegram и РФ-хостингом закрылся в обе
 * стороны: исходящие дали 0 успешных из 8, а доставка апдейтов к нам — `Connection timed out`.
 * Исходящие вылечены прокси, входящие лечить нечем: заставить чужой сервер достучаться до нас
 * мы не можем. При `polling` доступность снаружи перестаёт быть условием работы бота.
 *
 * **Что гарантируется.** Апдейт подтверждается смещением (`offset`) только после обработки, и
 * подтверждение уходит следующим запросом. Падение процесса между обработкой и подтверждением
 * означает **повтор**, а не потерю: повторы отсекаются на уровне use-case по `update_id`.
 */
@Injectable()
export class TelegramPollingRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly _logger = new Logger('TelegramPolling');
  private readonly _enabled: boolean;
  private readonly _hasToken: boolean;
  private _stopped = false;
  private _offset = 0;

  /**
   * @param _api Порт Bot API (получение апдейтов и снятие вебхука).
   * @param _handleTelegramUpdateUseCase Обработчик апдейта — тот же, что у вебхука.
   * @param _settings Рантайм-настройки: пауза бота.
   * @param configService Конфиг: режим получения апдейтов и токен.
   */
  public constructor(
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _handleTelegramUpdateUseCase: HandleTelegramUpdateUseCase,
    private readonly _settings: SettingsDomainService,
    configService: ConfigService<Env, true>,
  ) {
    this._enabled = configService.get('TELEGRAM_UPDATES_MODE', { infer: true }) === 'polling';
    this._hasToken = configService.get('TELEGRAM_BOT_TOKEN', { infer: true }) !== '';
  }

  /**
   * Поднимает цикл получения апдейтов, если режим включён.
   * @returns Промис завершения подготовки (сам цикл живёт дальше сам по себе).
   */
  public async onApplicationBootstrap(): Promise<void> {
    if (!this._enabled) {
      return;
    }
    if (!this._hasToken) {
      this._logger.warn('Режим polling включён, но токен пуст — апдейты не забираем.');
      return;
    }
    // Вебхук и getUpdates взаимоисключающи: не снять — Telegram ответит 409 на каждый запрос.
    const dropped = await this._api.deleteWebhook();
    this._logger.log(
      dropped
        ? 'Вебхук снят, получаем апдейты сами (long polling 50 с).'
        : 'Вебхук снять не удалось — пробуем забирать апдейты, при 409 круг просто повторится.',
    );
    // Намеренно без await: цикл живёт всё время работы приложения и не должен задерживать старт.
    void this._loop();
  }

  /**
   * Останавливает цикл при выключении приложения.
   * @returns Промис завершения.
   */
  public onModuleDestroy(): Promise<void> {
    this._stopped = true;
    return Promise.resolve();
  }

  /**
   * Бесконечный круг: спросить апдейты → обработать → подтвердить смещением.
   * @returns Промис, который разрешится при остановке приложения.
   */
  private async _loop(): Promise<void> {
    while (!this._stopped) {
      let updates: Awaited<ReturnType<TelegramApiPort['getUpdates']>> = [];
      try {
        updates = await this._api.getUpdates(this._offset, LONG_POLL_SECONDS);
      } catch (error) {
        // Порт гасит сбои сам, но чужая реализация может и бросить — цикл обязан выжить.
        this._logger.debug(`Круг опроса сорвался: ${String(error)}`);
        await delay(FAILURE_BACKOFF_MS);
        continue;
      }
      if (updates.length === 0) {
        await delay(SUCCESS_BACKOFF_MS);
        continue;
      }
      for (const update of updates) {
        // Смещение двигаем ДО обработки: упавший апдейт не должен зациклить очередь. Потеря
        // одного сообщения из-за ошибки в коде — плохо, но вечный повтор того же апдейта хуже:
        // он остановит доставку всем остальным.
        this._offset = update.update_id + 1;
        if (this._settings.getBoolean(SETTING_TELEGRAM_BOT_PAUSED)) {
          this._logger.log('Бот на паузе — апдейт получен и не обработан.');
          continue;
        }
        try {
          await this._handleTelegramUpdateUseCase.execute(update);
        } catch (error) {
          // Тело апдейта не логируем (ADR-0064 §10): в нём имя и возраст заявителя.
          this._logger.error(`Обработка апдейта сорвалась: ${String(error)}`);
        }
      }
    }
  }
}
