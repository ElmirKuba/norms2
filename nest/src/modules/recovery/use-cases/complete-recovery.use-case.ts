import { Injectable } from '@nestjs/common';
import { SecretQaDomainService } from '../domain-services/secret-qa.domain-service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';
import { SecretAnswer } from '../value-objects/secret-answer.vo';
import { Password } from '../../account/value-objects/password.vo';
import { RecoveryFailedError } from '../../../shared/errors/recovery-failed.error';

/** Ответ на вопрос (сырой) при завершении восстановления. */
export interface RawAnswer {
  /** Идентификатор вопроса. */
  questionId: string;
  /** Сырой ответ. */
  answer: string;
}

/**
 * Use-case завершения восстановления (public): сверяет K ответов и сбрасывает
 * пароль. Все провалы → единый `RecoveryFailedError` (анти-энумерация). Кросс-домен:
 * account↓ (найти аккаунт + K, сброс пароля), recovery↓ (сверка ответов).
 */
@Injectable()
export class CompleteRecoveryUseCase {
  /**
   * @param _secretQaDomainService Domain-service вопросов (сверка).
   * @param _accountDomainService Domain-service account (сброс пароля).
   */
  public constructor(
    private readonly _secretQaDomainService: SecretQaDomainService,
    private readonly _accountDomainService: AccountDomainService,
    private readonly _sessionDomainService: SessionDomainService,
  ) {}

  /**
   * Завершает восстановление: проверяет ответы, ставит новый пароль.
   * @param login Логин аккаунта.
   * @param answers Ответы на вопросы (по id).
   * @param newPasswordRaw Новый пароль (сырой).
   * @returns Промис завершения.
   * @throws {RecoveryFailedError} Неверный логин/число ответов/ответы.
   */
  public async execute(login: string, answers: RawAnswer[], newPasswordRaw: string): Promise<void> {
    const account = await this._accountDomainService.findRecoveryAccountByLogin(login);
    if (account === null || account.recoveryRequiredCount === null) {
      throw new RecoveryFailedError('Восстановление не удалось.');
    }
    if (answers.length !== account.recoveryRequiredCount) {
      throw new RecoveryFailedError('Восстановление не удалось.');
    }
    const attempts = answers.map((raw) => ({
      questionId: raw.questionId,
      answer: SecretAnswer.create(raw.answer),
    }));
    const verified = await this._secretQaDomainService.verifyAnswers(account.id, attempts);
    if (!verified) {
      throw new RecoveryFailedError('Восстановление не удалось.');
    }
    await this._accountDomainService.resetPassword(account.id, Password.create(newPasswordRaw));
    // После сброса пароля — отозвать все сессии (кросс-домен sessions↓): если
    // пароль восстанавливал не владелец, чужие активные сессии гасятся.
    await this._sessionDomainService.revokeAllForAccount(account.id);
  }
}
