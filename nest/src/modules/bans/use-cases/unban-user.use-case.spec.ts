import { UnbanUserUseCase } from './unban-user.use-case';
import { BanNotFoundError } from '../../../shared/errors/ban-not-found.error';
import type { BanFull } from '../interfaces/ban-full.interface';

/**
 * Право снятия бана (2.9.3·21, [ADR-0003, дополнение]).
 *
 * Тест стережёт симметрию, которой не было до 2.9.3: **банить может любой предок, а снимать мог
 * только тот, кто банил**. Артём был вправе забанить Дашу сам, но не вправе снять бан, наложенный
 * Викой, — хотя он выше по ветке и отвечает за подветку.
 *
 * Третий случай — посторонний — обязан получить **404, а не 403**: чужая запись не должна
 * подтверждать даже факт своего существования.
 */
describe('UnbanUserUseCase: кто вправе снимать', () => {
  const ban: BanFull = {
    id: 'ban-1',
    bannerId: 'vika',
    targetId: 'dasha',
    reason: 'за дело',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as BanFull;

  /** Собирает use-case с заглушками; `ancestors` — кто кому предок. */
  const useCaseOf = (ancestors: Record<string, string>) => {
    const lifted: string[] = [];
    const records: unknown[] = [];
    const bans = {
      getActive: async (): Promise<BanFull> => ban,
      lift: async (banId: string): Promise<void> => {
        lifted.push(banId);
      },
    };
    const tree = {
      isAncestor: async (ancestorId: string, descendantId: string): Promise<boolean> =>
        ancestors[descendantId] === ancestorId,
    };
    const audit = {
      record: async (entry: unknown): Promise<void> => {
        records.push(entry);
      },
    };
    const useCase = new UnbanUserUseCase(bans as never, tree as never, audit as never);
    return { useCase, lifted, records };
  };

  it('снимает тот, кто банил', async () => {
    const { useCase, lifted } = useCaseOf({});

    await useCase.execute('ban-1', 'vika', 'vika');

    expect(lifted).toEqual(['ban-1']);
  });

  it('снимает предок банившего — ответственность идёт вверх по ветке', async () => {
    const { useCase, lifted, records } = useCaseOf({ vika: 'artem' });

    await useCase.execute('ban-1', 'artem', 'artem');

    expect(lifted).toEqual(['ban-1']);
    expect(records).toHaveLength(1);
  });

  it('посторонний получает 404 и ничего не снимает', async () => {
    const { useCase, lifted, records } = useCaseOf({ vika: 'artem' });

    await expect(useCase.execute('ban-1', 'chuzhoy', 'chuzhoy')).rejects.toBeInstanceOf(
      BanNotFoundError,
    );
    expect(lifted).toEqual([]);
    expect(records).toEqual([]);
  });
});
