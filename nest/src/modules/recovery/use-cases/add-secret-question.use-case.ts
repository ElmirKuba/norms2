import { Injectable } from '@nestjs/common';
import { SecretQaDomainService } from '../domain-services/secret-qa.domain-service';
import { SecretQuestion } from '../value-objects/secret-question.vo';
import { SecretAnswer } from '../value-objects/secret-answer.vo';
import type { SecretQaView } from '../interfaces/secret-qa-view.interface';

/**
 * Use-case добавления секретного вопроса (для аутентифицированного аккаунта).
 * Валидирует VO, хеширует ответ (через domain), отдаёт проекцию без answerHash.
 */
@Injectable()
export class AddSecretQuestionUseCase {
  /**
   * @param _secretQaDomainService Domain-service вопросов.
   */
  public constructor(private readonly _secretQaDomainService: SecretQaDomainService) {}

  /**
   * Добавляет вопрос.
   * @param accountId Владелец (из Guard).
   * @param questionRaw Сырой текст вопроса.
   * @param answerRaw Сырой ответ.
   * @returns Проекция созданного вопроса.
   * @throws {ValidationError} Если вопрос/ответ не проходят VO.
   */
  public async execute(accountId: string, questionRaw: string, answerRaw: string): Promise<SecretQaView> {
    const created = await this._secretQaDomainService.addQuestion(
      accountId,
      SecretQuestion.create(questionRaw),
      SecretAnswer.create(answerRaw),
    );
    return { id: created.id, question: created.question };
  }
}
