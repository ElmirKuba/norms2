import { Module } from '@nestjs/common';
import { SECRET_QA_REPOSITORY } from './adapters/secret-qa-repository.port';
import { SecretQaRepository } from '../../database/repositories/secret-qa/secret-qa.repository';

/**
 * Модуль области recovery (восстановление по секретным вопросам, ADR-0008).
 * Пока — composition root репозитория секретных вопросов. Domain-service (R1.3),
 * settings/flow use-cases и контроллеры (R1.4/R1.5) добавятся далее; тогда же
 * модуль подключится в AppModule.
 */
@Module({
  providers: [{ provide: SECRET_QA_REPOSITORY, useClass: SecretQaRepository }],
})
export class RecoveryModule {}
