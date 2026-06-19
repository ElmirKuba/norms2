import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';

/**
 * Use-case очистки примеров привычек (`DELETE /accent/habits/starter-pack`). Тонкий:
 * domain удаляет только ещё не присвоенные стартовые (`is_starter=true`), своё не трогает.
 * Свежий список возвращает контроллер через `ListHabitsUseCase`.
 */
@Injectable()
export class ClearHabitStartersUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Число удалённых примеров.
   */
  public async execute(accountId: string): Promise<number> {
    return this._habits.clearStarters(accountId);
  }
}
