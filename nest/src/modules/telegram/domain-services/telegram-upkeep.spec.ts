import { TelegramUpkeepService } from './telegram-upkeep.service';

/**
 * Уборка заявок бота (2.9.3·35).
 *
 * **Что именно стережём.** Уборка висит на живом потоке апдейтов, а не на планировщике, и её
 * ошибки не должны трогать человека, который просто написал боту. Отсюда три инварианта:
 * работает вообще, не работает чаще раза в час, падает молча.
 */
describe('Уборка заявок бота', () => {
  /** Считалка вызовов порта; `fail` — заставить уборку упасть. */
  const repositoryOf = (fail = false) => {
    const calls = { expired: 0, purged: 0 };
    return {
      calls,
      port: {
        expirePendingOlderThan: async (): Promise<number> => {
          calls.expired += 1;
          if (fail) {
            throw new Error('база недоступна');
          }
          return 0;
        },
        purgeClosedGuestRequestsBefore: async (): Promise<number> => {
          calls.purged += 1;
          return 0;
        },
      },
    };
  };

  it('первый прогон делает обе работы: протухание и срок хранения', async () => {
    const { calls, port } = repositoryOf();
    const service = new TelegramUpkeepService(port as never);

    await service.sweepIfDue();

    expect(calls).toEqual({ expired: 1, purged: 1 });
  });

  it('второй прогон подряд ничего не делает — иначе уборка шла бы на каждое сообщение', async () => {
    const { calls, port } = repositoryOf();
    const service = new TelegramUpkeepService(port as never);

    await service.sweepIfDue();
    await service.sweepIfDue();
    await service.sweepIfDue();

    expect(calls).toEqual({ expired: 1, purged: 1 });
  });

  it('падение уборки не выбрасывается наружу — человек ждёт ответа бота, а не отчёта', async () => {
    const { port } = repositoryOf(true);
    const service = new TelegramUpkeepService(port as never);

    await expect(service.sweepIfDue()).resolves.toBeUndefined();
  });
});
