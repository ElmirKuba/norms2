import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { CreateAntiHabitDto } from '../dtos/create-anti-habit.dto';

/** Use-case создания анти-привычки (`POST /accent/anti-habits`). Тонкий. */
@Injectable()
export class CreateAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Проекция созданной анти-привычки.
   */
  public async execute(accountId: string, dto: CreateAntiHabitDto): Promise<AntiHabitView> {
    const created = await this._antiHabits.create({
      accountId,
      title: dto.title,
      description: dto.description ?? null,
      targetDays: dto.targetDays ?? null,
      startAt: dto.startAt ?? null,
    });
    return toAntiHabitView(created);
  }
}
