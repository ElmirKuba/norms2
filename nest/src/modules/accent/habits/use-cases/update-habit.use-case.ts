import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';
import type { HabitUpdateData } from '../adapters/accent-habit-repository.port';
import type { UpdateHabitDto } from '../dtos/update-habit.dto';

/**
 * Use-case обновления привычки (`PATCH /accent/habits/:id`). Тонкий: маппит тело в патч
 * (счётчики лесенки — плейсхолдер 0, реальные сохранит domain), domain валидирует/обновляет.
 */
@Injectable()
export class UpdateHabitUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для обновления.
   * @returns Проекция обновлённой привычки.
   */
  public async execute(id: string, accountId: string, dto: UpdateHabitDto): Promise<HabitView> {
    const patch: HabitUpdateData = {
      title: dto.title,
      description: dto.description,
      icon: dto.icon,
      domainKey: dto.domainKey,
      attributes: dto.attributes,
      goalId: dto.goalId,
      priority: dto.priority,
      kind: dto.kind,
      recurrence: dto.recurrence,
      startDate: dto.startDate,
      minVersion: dto.minVersion,
      ladder:
        dto.ladder === undefined
          ? undefined
          : {
              minTarget: dto.ladder.minTarget,
              currentTarget: dto.ladder.currentTarget,
              goalTarget: dto.ladder.goalTarget ?? null,
              step: dto.ladder.step ?? null,
              policy: dto.ladder.policy,
              easyStreak: 0,
              missStreak: 0,
            },
    };
    return toHabitView(await this._habits.update(id, accountId, patch));
  }
}
