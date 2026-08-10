import { Global, Module } from '@nestjs/common';
import { AUDIT_REPOSITORY } from './adapters/audit-repository.port';
import { AuditRepository } from '../../database/repositories/audit/audit.repository';
import { AuditDomainService } from './domain-services/audit.domain-service';

/**
 * Модуль журнала действий администратора (2.9.3·6) — composition root: биндит `AUDIT_REPOSITORY`
 * на Drizzle-реализацию и раздаёт `AuditDomainService`.
 *
 * **`@Global` осознанно, по той же причине, что и у настроек.** Писать в журнал будет каждая
 * админская операция, где бы она ни жила: роли — в `account`, пауза — в `settings`, удаление
 * публикаций — в `notifications`. Импорт модуля в каждую фичу был бы шумом, а забытый импорт —
 * молча непишущимся журналом.
 */
@Global()
@Module({
  providers: [{ provide: AUDIT_REPOSITORY, useClass: AuditRepository }, AuditDomainService],
  exports: [AuditDomainService],
})
export class AuditModule {}
