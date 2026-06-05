import { Module } from '@nestjs/common';
import { SECRET_QA_REPOSITORY } from './adapters/secret-qa-repository.port';
import { SecretQaRepository } from '../../database/repositories/secret-qa/secret-qa.repository';
import { SecretQaDomainService } from './domain-services/secret-qa.domain-service';

/**
 * Модуль области recovery (восстановление по секретным вопросам, ADR-0008).
 * Composition root: репозиторий вопросов + `SecretQaDomainService`. Settings/flow
 * use-cases и контроллеры (R1.4/R1.5) добавятся далее; тогда модуль подключится в
 * AppModule (и импортирует AccessControl/Account для Guard и кросс-домена).
 */
@Module({
  providers: [
    { provide: SECRET_QA_REPOSITORY, useClass: SecretQaRepository },
    SecretQaDomainService,
  ],
})
export class RecoveryModule {}
