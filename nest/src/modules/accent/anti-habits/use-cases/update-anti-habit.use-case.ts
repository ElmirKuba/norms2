import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { UpdateAntiHabitDto } from '../dtos/update-anti-habit.dto';

/** Use-case обновления анти-привычки (`PATCH /accent/anti-habits/:id`). Тонкий. */
@Injectable()
export class UpdateAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для обновления.
   * @returns Проекция обновлённой анти-привычки.
   */
  public async execute(
    id: string,
    accountId: string,
    dto: UpdateAntiHabitDto,
  ): Promise<AntiHabitView> {
    const updated = await this._antiHabits.update(id, accountId, {
      title: dto.title,
      description: dto.description,
      targetDays: dto.targetDays,
      isActive: dto.isActive,
    });
    return toAntiHabitView(updated);
  }
}
