import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/**
 * Use-case возврата перенесённой задачи на сегодня (`POST /accent/tasks/:id/unpostpone`, 2.7.2).
 * «Сегодня» считается по таймзоне аккаунта здесь — домен о таймзонах не знает.
 *
 * Кросс-вызов к домену привычек живёт именно тут: use-case — точка, где сходятся две области
 * (CLAUDE.md), а domain-service задач про привычки знать не должен.
 */
@Injectable()
export class UnpostponeTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   * @param _habits Domain-service привычек (проверка, что шаблон ещё жив).
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _habits: AccentHabitDomainService,
  ) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @returns Проекция вернувшейся в работу задачи.
   */
  public async execute(id: string, accountId: string, timezone: string): Promise<TaskView> {
    // Подстраховка на открытую вкладку: деактивация шаблона убирает такие задачи (·деактивация),
    // но кнопка «Вернуть на сегодня» могла остаться на уже загруженном экране. Вернуть задачу
    // удалённого шаблона нельзя — она станет сиротой в «Сегодня».
    const task = await this._tasks.getOwned(id, accountId);
    if (task.templateId !== null) {
      const habit = await this._habits.getOwned(task.templateId, accountId);
      if (!habit.isActive) {
        // Убираем саму сироту: иначе человек остаётся с карточкой и кнопкой, которая всегда
        // отвечает ошибкой. Сообщение при этом обязательно — задача исчезает с экрана, и
        // молчаливое исчезновение выглядело бы как сбой (реш. Elmir 05.08.2026).
        await this._tasks.removeOwned(id, accountId);
        throw new ValidationError('Шаблон этой привычки удалён — задача убрана из «Сегодня».');
      }
    }
    return toTaskView(await this._tasks.unpostpone(id, accountId, todayInTimezone(timezone)));
  }
}
