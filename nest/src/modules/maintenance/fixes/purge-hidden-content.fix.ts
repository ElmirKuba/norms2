import { Injectable, Logger } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../../accent/anti-habits/domain-services/accent-anti-habit.domain-service';
import { AccentObstacleDomainService } from '../../accent/obstacles/domain-services/accent-obstacle.domain-service';
import { AccentMicroWinDomainService } from '../../accent/micro-wins/domain-services/accent-micro-win.domain-service';
import { AccentHabitDomainService } from '../../accent/habits/domain-services/accent-habit.domain-service';
import type { DataFix } from '../domain-services/data-fix.interface';

/**
 * Починка: убранное до 2.9.3 — это несостоявшееся удаление (2.9.3·25).
 *
 * До 2.9.3 «убрать из списка» было дорогой в один конец: вернуть спрятанное человек не мог
 * ничем — экрана архива не существовало. Значит тот, кто прятал, скорее всего хотел удалить,
 * другого способа у него просто не было. С появлением обратимого архива старое скрытое трактуем
 * как удаление (реш. Elmir 14.08.2026).
 *
 * **Зовёт доменные `delete()`, а не SQL.** Разовую зачистку 14.08.2026 пришлось сделать миграцией
 * `0050` — сырым SQL, который знал правила наизусть: какие таблицы мягкие, где сносить
 * `pending`-задачи. Больше так не пишем: правила живут в коде и меняются, а миграция застывает
 * ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 */
@Injectable()
export class PurgeHiddenContentFix implements DataFix {
  /** Ключ отметки. */
  public readonly key = 'purge-hidden-content-v1';
  /** Подпись для лога. */
  public readonly title = 'скрытое до 2.9.3 → удалено';

  private readonly _logger = new Logger(PurgeHiddenContentFix.name);

  /**
   * @param _antiHabits «Держусь».
   * @param _obstacles Препятствия.
   * @param _microWins Микро-победы.
   * @param _habits Шаблоны привычек.
   */
  public constructor(
    private readonly _antiHabits: AccentAntiHabitDomainService,
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _microWins: AccentMicroWinDomainService,
    private readonly _habits: AccentHabitDomainService,
  ) {}

  /**
   * Проходит по архивам всех аккаунтов и удаляет их содержимое доменным путём.
   * @param accountIds Живые аккаунты.
   * @returns Сколько записей удалено.
   */
  public async run(accountIds: readonly string[]): Promise<number> {
    let removed = 0;
    let skippedHabits = 0;

    for (const accountId of accountIds) {
      for (const item of await this._antiHabits.list(accountId, true)) {
        await this._antiHabits.delete(item.id, accountId);
        removed += 1;
      }

      const obstacles = await this._obstacles.list(accountId, true);
      for (const item of obstacles.items) {
        await this._obstacles.remove(item.id, accountId);
        removed += 1;
      }

      for (const item of await this._microWins.list(accountId, true)) {
        await this._microWins.remove(item.id, accountId);
        removed += 1;
      }

      // Шаблоны привычек оставляем в архиве: доменного удаления у них нет, потому что нет и
      // кнопки — на экране привычка уходит в архив и живёт там. Заводить `delete()` ради починки
      // значило бы тащить в продукт операцию, которой человек не видит. Но молчать нельзя:
      // если такие остались, об этом надо узнать из лога, а не случайно.
      skippedHabits += (await this._habits.list(accountId, true)).length;
    }

    if (skippedHabits > 0) {
      this._logger.warn(
        `Архивных привычек не тронуто: ${skippedHabits} — у шаблонов нет доменного удаления`,
      );
    }
    return removed;
  }
}
