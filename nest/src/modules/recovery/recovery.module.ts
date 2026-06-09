import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AccessControlModule } from '../auth/access-control.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SECRET_QA_REPOSITORY } from './adapters/secret-qa-repository.port';
import { SecretQaRepository } from '../../database/repositories/secret-qa/secret-qa.repository';
import { SecretQaDomainService } from './domain-services/secret-qa.domain-service';
import { RecoverySettingsController } from './controllers/recovery-settings.controller';
import { RecoveryController } from './controllers/recovery.controller';
import { AddSecretQuestionUseCase } from './use-cases/add-secret-question.use-case';
import { RemoveSecretQuestionUseCase } from './use-cases/remove-secret-question.use-case';
import { ListMySecretQuestionsUseCase } from './use-cases/list-my-secret-questions.use-case';
import { SetRecoveryRequiredCountUseCase } from './use-cases/set-recovery-required-count.use-case';
import { StartRecoveryUseCase } from './use-cases/start-recovery.use-case';
import { CompleteRecoveryUseCase } from './use-cases/complete-recovery.use-case';

/**
 * Модуль области recovery (восстановление по секретным вопросам, ADR-0008).
 * Settings-роуты под Guard (`AccessControlModule`), флоу `start/complete` —
 * публичный. Кросс-домен ВНИЗ → `AccountModule` (сброс пароля, K, поиск по логину).
 */
@Module({
  imports: [AccountModule, AccessControlModule, SessionsModule],
  controllers: [RecoverySettingsController, RecoveryController],
  providers: [
    { provide: SECRET_QA_REPOSITORY, useClass: SecretQaRepository },
    SecretQaDomainService,
    AddSecretQuestionUseCase,
    RemoveSecretQuestionUseCase,
    ListMySecretQuestionsUseCase,
    SetRecoveryRequiredCountUseCase,
    StartRecoveryUseCase,
    CompleteRecoveryUseCase,
  ],
  // Экспорт для кросс-домена вниз (статистика overview считает вопросы, F4).
  exports: [SecretQaDomainService],
})
export class RecoveryModule {}
