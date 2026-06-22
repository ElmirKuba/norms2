import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalView } from '../interfaces/goal-view.interface';
import type { GoalView } from '../interfaces/goal-view.interface';
import type { CreateGoalDto } from '../dtos/create-goal.dto';

/**
 * Use-case создания цели (`POST /accent/goals`). Тонкий: собирает данные из тела +
 * аккаунта; domain валидирует (род/значения/глубину) и создаёт.
 */
@Injectable()
export class CreateGoalUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Проекция созданной цели.
   */
  public async execute(accountId: string, dto: CreateGoalDto): Promise<GoalView> {
    const created = await this._goals.create({
      accountId,
      title: dto.title,
      direction: dto.direction,
      unit: dto.unit,
      targetValue: dto.targetValue,
      parentGoalId: dto.parentGoalId ?? null,
      whyItMatters: dto.whyItMatters ?? null,
      domainKey: dto.domainKey ?? null,
      attributes: dto.attributes ?? [],
      startValue: dto.startValue ?? null,
      deadline: dto.deadline ?? null,
      fallbackVersion: dto.fallbackVersion ?? null,
    });
    return toGoalView(created);
  }
}
