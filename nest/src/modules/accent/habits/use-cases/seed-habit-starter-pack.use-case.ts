import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';

/**
 * Use-case получения стартового пака привычек (`POST /accent/habits/starter-pack`). Тонкий:
 * domain докидывает примеры (`is_starter=true`, дедуп по названию, своё не трогает; ADR-0051).
 * Свежий список возвращает контроллер через `ListHabitsUseCase`.
 */
@Injectable()
export class SeedHabitStarterPackUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Число созданных примеров.
   */
  public async execute(accountId: string): Promise<number> {
    return this._habits.seedStarterPack(accountId);
  }
}
