import { Injectable } from '@nestjs/common';
import { SecretQaDomainService } from '../domain-services/secret-qa.domain-service';
import type { SecretQaView } from '../interfaces/secret-qa-view.interface';

/**
 * Use-case «мои секретные вопросы» — проекции без answerHash.
 */
@Injectable()
export class ListMySecretQuestionsUseCase {
  /**
   * @param _secretQaDomainService Domain-service вопросов.
   */
  public constructor(private readonly _secretQaDomainService: SecretQaDomainService) {}

  /**
   * Возвращает мои вопросы.
   * @param accountId Владелец (из Guard).
   * @returns Проекции.
   */
  public async execute(accountId: string): Promise<SecretQaView[]> {
    const questions = await this._secretQaDomainService.listQuestions(accountId);
    return questions.map((question) => ({ id: question.id, question: question.question }));
  }
}
