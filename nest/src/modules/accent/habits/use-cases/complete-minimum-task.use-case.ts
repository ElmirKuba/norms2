import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/** Результат «сделал минимум»: задача + была ли микро-победа отмечена впервые за день. */
export interface CompleteMinimumResult {
  /** Задача после зачёта (статус `partial`, значение = `ladder.minTarget`). */
  task: TaskView;
  /** `true`, если лог микро-победы записан впервые сегодня (повтор — `false`). */
  microWinNewlyCompleted: boolean;
}

/**
 * Use-case «сделал минимум» (`POST /accent/tasks/:id/complete-minimum`, 2.7·H). Одно действие
 * человека — одна операция сервера: лог микро-победы и частичный зачёт задачи в одной
 * транзакции. Двумя запросами с фронта это было бы двумя способами оборваться на середине.
 */
@Injectable()
export class CompleteMinimumTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (день лога микро-победы считается по ней).
   * @returns Задача после зачёта + признак первого лога за день.
   */
  public async execute(
    id: string,
    accountId: string,
    timezone: string,
  ): Promise<CompleteMinimumResult> {
    const { task, microWinNewlyCompleted } = await this._tasks.completeMinimum(
      id,
      accountId,
      todayInTimezone(timezone),
    );
    return { task: toTaskView(task), microWinNewlyCompleted };
  }
}
