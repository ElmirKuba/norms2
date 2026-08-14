import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATA_FIX_STATE } from '../adapters/data-fix-state.port';
import { PurgeHiddenContentFix } from '../fixes/purge-hidden-content.fix';
import type { OnApplicationBootstrap } from '@nestjs/common';
import type { DataFixStatePort } from '../adapters/data-fix-state.port';
import type { DataFix } from './data-fix.interface';

/**
 * Раннер разовых починок данных (2.9.3·25, реш. Elmir 14.08.2026).
 *
 * **Зачем он вместо очередной миграции.** Данные, которые надо привести в порядок по
 * бизнес-правилам, нельзя чинить SQL-ом: правила живут в коде и меняются, а миграция застывает
 * навсегда и однажды начинает врать. Поэтому приложение при подъёме **зовёт свой же `delete()`**
 * и свято верит, что удалило; что при этом делает хранилище — его дело
 * ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 *
 * **Граница:** починки правят **данные**, миграции — **схему**. Смешивать нельзя.
 *
 * **Падение починки не мешает старту.** Приложение поднимается в любом случае: отказ ложится в
 * лог уровня `error`, отметка не ставится, и следующий подъём попробует снова. Обратный выбор —
 * не пускать продукт, пока не починились данные, — превращает разовую задачу в единую точку
 * отказа (та же логика, что у журнала в 2.9.3·6).
 */
@Injectable()
export class DataFixRunner implements OnApplicationBootstrap {
  private readonly _logger = new Logger(DataFixRunner.name);

  /** Список починок по порядку. Ключи стабильны: переименование = повторный прогон. */
  private readonly _fixes: DataFix[];

  /**
   * @param _state Порт отметок и списка аккаунтов.
   * @param purgeHiddenContent Первая починка: скрытое до 2.9.3 → удалено.
   */
  public constructor(
    @Inject(DATA_FIX_STATE) private readonly _state: DataFixStatePort,
    purgeHiddenContent: PurgeHiddenContentFix,
  ) {
    this._fixes = [purgeHiddenContent];
  }

  /**
   * Прогоняет неотработавшие починки при подъёме приложения.
   * @returns Промис завершения.
   */
  public async onApplicationBootstrap(): Promise<void> {
    for (const fix of this._fixes) {
      try {
        if (await this._state.isDone(fix.key)) {
          continue;
        }
        const accountIds = await this._state.listAccountIds();
        const touched = await fix.run(accountIds);
        await this._state.markDone(fix.key);
        this._logger.log(`Починка '${fix.key}' (${fix.title}): затронуто ${touched}`);
      } catch (error) {
        // Отметка не ставится — следующий подъём попробует снова.
        this._logger.error(`Починка '${fix.key}' не прошла: ${String(error)}`);
      }
    }
  }
}
