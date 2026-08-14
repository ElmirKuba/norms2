import { AccentCounterplayDomainService } from './accent-counterplay.domain-service';
import { ValidationError } from '../../../../shared/errors/validation.error';

/**
 * Слабые ссылки после снятия каскадов (2.9.3·34, долг из ·17).
 *
 * **Почему тест появился.** До 2.9.3 удаление микро-победы обнуляло `linked_micro_win_id` силами
 * базы (`on delete set null`). Каскады сняты ([ADR-0068](../../../../../docs/decisions/0068-deletion-belongs-to-storage.md)),
 * и теперь ссылка переживает удаление цели: обнулять её мы не стали намеренно — иначе ручное
 * восстановление возвращало бы запись без связей. Цена решения — **проверять живость обязан
 * читатель**, и это ровно тот вид обязанности, который забывается через месяц.
 *
 * Здесь стережётся первая половина: **привязать контрмеру к удалённой микро-победе нельзя**.
 * Домен микро-побед её не отдаёт (для него удалённой нет), и валидация обязана превратить это в
 * отказ, а не в тихую ссылку-призрак.
 */
describe('Контрмера: привязка к микро-победе', () => {
  /** Собирает domain-service с заглушками; `known` — id живых микро-побед. */
  const serviceOf = (known: string[]) => {
    const created: unknown[] = [];
    const repository = {
      countInObstacle: async (): Promise<number> => 0,
      create: async (data: unknown): Promise<unknown> => {
        created.push(data);
        return data;
      },
    };
    const microWins = {
      getOwned: async (id: string): Promise<{ id: string }> => {
        if (!known.includes(id)) {
          // Ровно так ведёт себя настоящий domain-service: удалённой микро-победы для него нет.
          throw new Error('не найдена');
        }
        return { id };
      },
    };
    const obstacles = { getOwned: async (): Promise<{ id: string }> => ({ id: 'ob-1' }) };
    const service = new AccentCounterplayDomainService(
      repository as never,
      obstacles as never,
      microWins as never,
    );
    return { service, created };
  };

  it('привязка к живой микро-победе проходит', async () => {
    const { service, created } = serviceOf(['mw-alive']);

    await service.create({
      obstacleId: 'ob-1',
      accountId: 'acc-1',
      text: 'Выпить воды и вернуться',
      linkedMicroWinId: 'mw-alive',
    });

    expect(created).toHaveLength(1);
  });

  it('привязка к удалённой микро-победе отбивается, а не сохраняется призраком', async () => {
    const { service, created } = serviceOf(['mw-alive']);

    await expect(
      service.create({
        obstacleId: 'ob-1',
        accountId: 'acc-1',
        text: 'Ссылка в никуда',
        linkedMicroWinId: 'mw-deleted',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(created).toEqual([]);
  });

  it('без привязки контрмера создаётся — поле необязательное', async () => {
    const { service, created } = serviceOf([]);

    await service.create({ obstacleId: 'ob-1', accountId: 'acc-1', text: 'Просто ответ' });

    expect(created).toHaveLength(1);
  });
});
