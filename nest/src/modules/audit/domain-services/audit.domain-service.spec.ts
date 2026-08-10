import { AUDIT_ACTIONS, AuditDomainService } from './audit.domain-service';
import type { AuditRepositoryPort } from '../adapters/audit-repository.port';
import type { AuditEntryBase } from '../interfaces/audit-entry-base.interface';
import type { AuditEntryFull } from '../interfaces/audit-entry-full.interface';

/**
 * Тесты журнала действий администратора (2.9.3·6).
 *
 * Проверяются решения, которые легко сломать незаметно и дорого обнаружить на бою:
 * 1. сбой журнала **не роняет** вызвавшую операцию — иначе журнал становится единой точкой отказа;
 * 2. системное действие пишется с **пустым актёром**, а не теряется;
 * 3. незаданные поля приходят в репозиторий как `null`, а не `undefined` — иначе в базу уедет
 *    строка с пропущенными колонками.
 */
describe('AuditDomainService', () => {
  /** Репозиторий, запоминающий переданное. */
  const spyRepository = (): { port: AuditRepositoryPort; calls: AuditEntryBase[] } => {
    const calls: AuditEntryBase[] = [];
    const port = {
      append: async (entry: AuditEntryBase): Promise<AuditEntryFull> => {
        calls.push(entry);
        return { ...entry, id: 'log-1', createdAt: new Date() };
      },
      findRecent: async (): Promise<AuditEntryFull[]> => [],
    };
    return { port, calls };
  };

  /** Репозиторий, который всегда падает. */
  const brokenRepository = (): AuditRepositoryPort =>
    ({
      append: async (): Promise<never> => {
        throw new Error('база недоступна');
      },
      findRecent: async (): Promise<AuditEntryFull[]> => [],
    }) as AuditRepositoryPort;

  it('не бросает, когда журнал недоступен: операция важнее записи о ней', async () => {
    const service = new AuditDomainService(brokenRepository());
    await expect(service.record({ action: AUDIT_ACTIONS.SETTING_CHANGED })).resolves.toBeUndefined();
  });

  it('системное действие пишется с пустым актёром, а не теряется', async () => {
    const { port, calls } = spyRepository();
    const service = new AuditDomainService(port);

    await service.record({ action: AUDIT_ACTIONS.ROLE_GRANTED, targetLabel: 'elmir_kuba' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.actorAccountId).toBeNull();
    expect(calls[0]?.actorLogin).toBeNull();
    expect(calls[0]?.targetLabel).toBe('elmir_kuba');
  });

  it('незаданные поля превращаются в null, а не уезжают undefined', async () => {
    const { port, calls } = spyRepository();
    const service = new AuditDomainService(port);

    await service.record({ action: AUDIT_ACTIONS.ROLE_BACKFILLED });

    const entry = calls[0];
    expect(entry).toBeDefined();
    for (const key of ['targetType', 'targetId', 'targetLabel', 'details'] as const) {
      expect(entry?.[key]).toBeNull();
    }
  });

  it('сохраняет актёра и подробности, когда действует человек', async () => {
    const { port, calls } = spyRepository();
    const service = new AuditDomainService(port);

    await service.record({
      action: AUDIT_ACTIONS.SETTING_CHANGED,
      actorAccountId: 'acc-1',
      actorLogin: 'elmir_kuba',
      targetId: 'telegram.bot.paused',
      details: { from: 'false', to: 'true' },
    });

    expect(calls[0]?.actorAccountId).toBe('acc-1');
    expect(calls[0]?.details).toEqual({ from: 'false', to: 'true' });
  });
});
