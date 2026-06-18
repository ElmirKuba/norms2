import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';
import type { CreateHabitDto } from '../dtos/create-habit.dto';

/**
 * Use-case создания привычки (`POST /accent/habits`). Тонкий: собирает данные из тела +
 * аккаунта (лесенка со счётчиками 0), domain валидирует и создаёт.
 */
@Injectable()
export class CreateHabitUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Проекция созданной привычки.
   */
  public async execute(accountId: string, dto: CreateHabitDto): Promise<HabitView> {
    const created = await this._habits.create({
      accountId,
      title: dto.title,
      kind: dto.kind,
      recurrence: dto.recurrence,
      ladder: {
        minTarget: dto.ladder.minTarget,
        currentTarget: dto.ladder.currentTarget,
        goalTarget: dto.ladder.goalTarget ?? null,
        step: dto.ladder.step ?? null,
        policy: dto.ladder.policy,
        easyStreak: 0,
        missStreak: 0,
      },
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      domainKey: dto.domainKey ?? null,
      attributes: dto.attributes ?? [],
      goalId: dto.goalId ?? null,
      priority: dto.priority ?? 0,
      minVersion: dto.minVersion ?? null,
    });
    return toHabitView(created);
  }
}
