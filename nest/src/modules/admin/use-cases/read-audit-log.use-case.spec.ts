import {
  DEFAULT_AUDIT_LIMIT,
  MAX_AUDIT_LIMIT,
  ReadAuditLogUseCase,
} from './read-audit-log.use-case';
import { AUDIT_ACTIONS } from '../../audit/domain-services/audit.domain-service';
import type { AuditDomainService } from '../../audit/domain-services/audit.domain-service';
import type { AuditEntryFull } from '../../audit/interfaces/audit-entry-full.interface';

/**
 * Тесты чтения журнала действий (2.9.3·14).
 *
 * Стерегут два решения, которые легко потерять при правке:
 * 1. **`actorAccountId` не уходит наружу** — экрану хватает логина, а PK, отданный «за компанию»,
 *    потом всплывает в URL и логах;
 * 2. **потолок выборки соблюдается** — `?limit=100000` не должен превращаться в выгрузку всего
 *    журнала одним запросом.
 */
describe('ReadAuditLogUseCase', () => {
  /** Строка журнала-образец: системная запись сида. */
  const entry: AuditEntryFull = {
    id: 'audit-1',
    createdAt: new Date('2026-08-13T10:00:00Z'),
    actorAccountId: null,
    actorLogin: null,
    action: AUDIT_ACTIONS.ROLE_BACKFILLED,
    targetType: 'account',
    targetId: 'acc-1',
    targetLabel: 'audit_probe',
    details: { role: 'user' },
  };

  /** Доменный сервис-заглушка, запоминающий аргументы чтения. */
  const auditOf = (): { service: AuditDomainService; calls: [number, string | null][] } => {
    const calls: [number, string | null][] = [];
    const service = {
      recent: async (limit: number, action: string | null): Promise<AuditEntryFull[]> => {
        calls.push([limit, action]);
        return [entry];
      },
    } as unknown as AuditDomainService;
    return { service, calls };
  };

  it('наружу уходит логин, но не PK аккаунта', async () => {
    const { service } = auditOf();
    const useCase = new ReadAuditLogUseCase(service);

    const [row] = await useCase.execute(10, null);

    expect(row).toEqual({
      id: 'audit-1',
      createdAt: entry.createdAt,
      actorLogin: null,
      action: AUDIT_ACTIONS.ROLE_BACKFILLED,
      targetType: 'account',
      targetId: 'acc-1',
      targetLabel: 'audit_probe',
      details: { role: 'user' },
    });
    expect(row).not.toHaveProperty('actorAccountId');
  });

  it('мусорный и запредельный limit приводятся к разумному, фильтр доходит как есть', async () => {
    const { service, calls } = auditOf();
    const useCase = new ReadAuditLogUseCase(service);

    await useCase.execute(Number.NaN, null);
    await useCase.execute(0, null);
    await useCase.execute(100_000, AUDIT_ACTIONS.ROLE_GRANTED);

    expect(calls).toEqual([
      [DEFAULT_AUDIT_LIMIT, null],
      [DEFAULT_AUDIT_LIMIT, null],
      [MAX_AUDIT_LIMIT, AUDIT_ACTIONS.ROLE_GRANTED],
    ]);
  });
});
