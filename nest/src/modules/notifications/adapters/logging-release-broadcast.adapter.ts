import { Injectable, Logger } from '@nestjs/common';
import type { ReleaseAnnouncement, ReleaseBroadcastPort } from './release-broadcast.port';

/**
 * Заглушка вещания: пишет в лог вместо отправки наружу (2.9.1·3).
 *
 * **Это не «пока не готово», а рабочий режим по умолчанию.** Пустой `TELEGRAM_BOT_TOKEN` — и
 * продукт живёт как жил: ноты появляются в колокольчике, наружу не уходит ничего. Такой же приём
 * использован в «Держусь» (`logging-anti-habit-events.adapter`) — он же делает фичу обратимой:
 * удалить Telegram = вернуть биндинг сюда.
 *
 * Возвращает `true`: «доставлено» в лог — значит нота помечается объявленной и в следующий
 * старт не повторяется. Иначе каждый рестарт на dev писал бы одно и то же.
 */
@Injectable()
export class LoggingReleaseBroadcastAdapter implements ReleaseBroadcastPort {
  private readonly _logger = new Logger('ReleaseBroadcast');

  /**
   * «Объявляет» релиз записью в лог.
   * @param announcement Что объявляем.
   * @returns Всегда `true`.
   */
  public announce(announcement: ReleaseAnnouncement): Promise<boolean> {
    this._logger.log(
      `Объявил бы релиз: «${announcement.title}» (${announcement.key}, ${announcement.contentFile ?? 'страница'})`,
    );
    return Promise.resolve(true);
  }
}
