import { Inject, Injectable, Logger } from '@nestjs/common';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';

/** Через сколько дней незакрытая заявка протухает. */
const PENDING_TTL_DAYS = 7;

/** Через сколько дней закрытая гостевая заявка удаляется вместе с адресом чата. */
const GUEST_RETENTION_DAYS = 180;

/** Не чаще раза в час: уборка идёт на входящем апдейте, а их бывает много подряд. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Уборка заявок бота (2.9.3·35, найдено аудитом 14.08.2026).
 *
 * **Две обязанности, которые были объявлены и не исполнялись.**
 *
 * 1. **Протухание.** `expirePendingOlderThan` был написан в 2.9.1 вместе с портом и
 *    репозиторием — и его никто не вызывал. Заявка висела `pending` вечно, а частичный unique
 *    `telegram_requests_one_pending_per_chat` разрешает **одну** незакрытую на чат: человек,
 *    чью заявку не разобрали, оказывался заперт навсегда — бот отвечал «заявка уже подана» и
 *    на второй день, и через полгода. Мёртвый код тут был не лишним файлом, а невыполненным
 *    обещанием: срок «7 дней» стоял в комментарии схемы как факт.
 * 2. **Срок хранения адреса.** Заявка на вступление подаётся **до** регистрации, аккаунта у неё
 *    нет — значит её не уносит ни каскад удаления аккаунта, ни отвязка чата. Идентификатор чата
 *    гостя, которому отказали, лежал бы в базе вечно. Вопрос стоял открытым в
 *    [ADR-0064 §10](../../../../docs/decisions/0064-telegram-release-channel.md) («предложение —
 *    удалять закрытые заявки старше полугода, пока не решено»); теперь решено и сделано.
 *
 * **Почему на апдейте, а не по расписанию.** Планировщика в проекте нет, и заводить зависимость
 * ради двух запросов в час — плата больше пользы. Уборка цепляется к входящему апдейту и
 * ограничена таймером в памяти процесса: перезапуск сбрасывает счётчик, но операции
 * идемпотентны, лишний прогон стоит два индексных запроса. Обратная сторона честная: **пока бот
 * молчит, уборка не идёт** — у выключенного бота новых заявок и не появляется.
 *
 * **Падение уборки не мешает разбору апдейта.** Человек написал боту — он ждёт ответа, а не
 * отчёта о хозяйственных работах; отказ ложится в лог.
 */
@Injectable()
export class TelegramUpkeepService {
  private readonly _logger = new Logger(TelegramUpkeepService.name);

  /** Когда убирались в последний раз. `null` — ещё ни разу за жизнь процесса. */
  private _lastSweptAt: number | null = null;

  /**
   * @param _repository Порт хранилища заявок.
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
  ) {}

  /**
   * Прогоняет уборку, если с прошлой прошёл час; иначе молча возвращается.
   * @returns Промис завершения.
   */
  public async sweepIfDue(): Promise<void> {
    const now = Date.now();
    if (this._lastSweptAt !== null && now - this._lastSweptAt < SWEEP_INTERVAL_MS) {
      return;
    }
    this._lastSweptAt = now;

    try {
      const expired = await this._repository.expirePendingOlderThan(
        new Date(now - PENDING_TTL_DAYS * DAY_MS),
      );
      const purged = await this._repository.purgeClosedGuestRequestsBefore(
        new Date(now - GUEST_RETENTION_DAYS * DAY_MS),
      );
      if (expired > 0 || purged > 0) {
        this._logger.log(`Уборка заявок: протухло ${expired}, удалено гостевых ${purged}`);
      }
    } catch (error) {
      this._logger.error(`Уборка заявок не прошла: ${String(error)}`);
    }
  }
}
