import { Injectable } from '@nestjs/common';
import { SecretQaDomainService } from '../domain-services/secret-qa.domain-service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { RecoveryNotAvailableError } from '../../../shared/errors/recovery-not-available.error';
import type { RecoveryQuestion } from '../interfaces/recovery-question.interface';

/**
 * Use-case старта восстановления (public): по логину выдаёт K случайных вопросов.
 * Кросс-домен: account↓ (найти аккаунт + K), recovery↓ (выбрать вопросы).
 */
@Injectable()
export class StartRecoveryUseCase {
  /**
   * @param _secretQaDomainService Domain-service вопросов.
   * @param _accountDomainService Domain-service account.
   */
  public constructor(
    private readonly _secretQaDomainService: SecretQaDomainService,
    private readonly _accountDomainService: AccountDomainService,
  ) {}

  /**
   * Стартует восстановление.
   * @param login Логин аккаунта.
   * @returns K случайных вопросов (без ответов).
   * @throws {RecoveryNotAvailableError} Если аккаунт/K не настроены или вопросов < K.
   */
  public async execute(login: string): Promise<RecoveryQuestion[]> {
    // Анти-энумерацию НЕ делаем (реш. Elmir 2026-06-11): логины публичны by design
    // (псевдонимы; профиль открыт по /accounts/:login, занятость видна при реге),
    // площадка инвайт-онли, на /recovery/start стоит rate-limit (F5.5). Доп-сигнал
    // «настроено ли восстановление» маргинален, а «единый ответ» ломал бы UX (нужно
    // показать реальные вопросы) → 409 «недоступно» приемлемо.
    const account = await this._accountDomainService.findRecoveryAccountByLogin(login);
    if (account === null || account.recoveryRequiredCount === null) {
      throw new RecoveryNotAvailableError('Восстановление для этого аккаунта недоступно.');
    }
    const required = account.recoveryRequiredCount;
    const questions = await this._secretQaDomainService.pickRandomK(account.id, required);
    if (questions.length < required) {
      throw new RecoveryNotAvailableError('Восстановление для этого аккаунта недоступно.');
    }
    return questions;
  }
}
