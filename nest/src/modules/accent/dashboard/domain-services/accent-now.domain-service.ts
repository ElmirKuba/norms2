import { Injectable } from '@nestjs/common';
import type { TaskFull } from '../../habits/interfaces/task-full.interface';
import type { MicroWinFull } from '../../micro-wins/interfaces/micro-win-full.interface';
import type { DashboardNow } from '../interfaces/dashboard-now.interface';

/**
 * «Сейчас» — герой дашборда (2.11): что человеку делать в эту минуту.
 *
 * **Почему отдельный сервис, а не пара строк в агрегаторе.** Это единственное место продукта,
 * которое *решает за человека*, и решать оно будет всё умнее: в 2.8 сюда придёт состояние из
 * чек-ина (низкая энергия → минимум вместо полной задачи), позже — история «что он реально
 * делает». Правило, спрятанное внутри сборки ответа, такого роста не переживёт.
 *
 * **Чистая функция над готовыми данными:** ничего не запрашивает сам — всё приходит из
 * агрегатора, который уже собрал день. Так его поведение проверяемо целиком, без БД.
 *
 * Правила rule-based ([ADR-0063](../../../../../docs/decisions/0063-no-llm-in-critical-path.md)):
 * ИИ в критическом пути нет и не планируется.
 */
@Injectable()
export class AccentNowDomainService {
  /**
   * Выбирает единственное дело «на сейчас». Порядок жёсткий, побеждает первое сработавшее:
   *
   * 1. **Просрочка** — у разовой задачи был срок, и он прошёл. Это единственное, что уже
   *    подвело: остальное ещё можно сделать сегодня.
   * 2. **Задача дня** — незакрытая (`pending`/`partial`). Берём первую по порядку: приоритет
   *    внутри дня человек уже расставил сам, второй раз за него не решаем.
   * 3. **Микро-победа** — день закрыт, но есть невыполненная сегодня. Не «добей ещё», а «если
   *    есть силы — вот маленькое».
   * 4. **Всё сделано** — дела не выдумываем. Пустой день без привычек попадает сюда же: у
   *    человека сегодня по расписанию ничего нет, и это нормально, а не провал.
   *
   * @param overdue Просроченные разовые задачи (свежие сверху).
   * @param todayTasks Задачи дня в порядке показа.
   * @param microWins Микро-победы аккаунта.
   * @param completedMicroWinIds Идентификаторы выполненных сегодня микро-побед.
   * @returns Что делать сейчас.
   */
  public choose(
    overdue: readonly TaskFull[],
    todayTasks: readonly TaskFull[],
    microWins: readonly MicroWinFull[],
    completedMicroWinIds: ReadonlySet<string>,
  ): DashboardNow {
    const late = overdue[0];
    if (late !== undefined) {
      return { kind: 'overdue', title: late.title, taskId: late.id, microWinId: null };
    }

    const open = todayTasks.find((task) => task.status === 'pending' || task.status === 'partial');
    if (open !== undefined) {
      return { kind: 'task', title: open.title, taskId: open.id, microWinId: null };
    }

    // Примеры-витрины (ADR-0051) не предлагаем: пока человек не забрал пример себе, он не его.
    const micro = microWins.find((win) => !win.isStarter && !completedMicroWinIds.has(win.id));
    if (micro !== undefined) {
      return { kind: 'micro_win', title: micro.title, taskId: null, microWinId: micro.id };
    }

    return { kind: 'all_done', title: null, taskId: null, microWinId: null };
  }
}
