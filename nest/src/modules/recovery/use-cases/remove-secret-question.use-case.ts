import { Injectable } from '@nestjs/common';
import { SecretQaDomainService } from '../domain-services/secret-qa.domain-service';

/**
 * Use-case удаления своего секретного вопроса.
 */
@Injectable()
export class RemoveSecretQuestionUseCase {
  /**
   * @param _secretQaDomainService Domain-service вопросов.
   */
  public constructor(private readonly _secretQaDomainService: SecretQaDomainService) {}

  /**
   * Удаляет вопрос.
   * @param id Идентификатор вопроса.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   * @throws {SecretQaNotFoundError} Если вопрос не найден/не свой.
   */
  public async execute(id: string, accountId: string): Promise<void> {
    await this._secretQaDomainService.removeOwn(id, accountId);
  }
}
