import { AccentAntiHabitDomainService } from './accent-anti-habit.domain-service';
import { AntiHabitNotFoundError } from '../../../../shared/errors/anti-habit-not-found.error';
import type { AntiHabitFull } from '../interfaces/anti-habit-full.interface';

/**
 * Архив и удаление «Держусь» (2.9.3·18, [ADR-0068]).
 *
 * Стерегут ровно то, что было сломано до 2.9.3 и чинилось как продуктовая болячка:
 * 1. **оба перехода архива существуют** — вход без выхода и есть та самая дорога в один конец;
 * 2. **архив и удаление — разные операции**: первый двигает состояние продукта (`isActive`),
 *    второй уходит в хранилище и для домена безвозвратен;
 * 3. **чужое и несуществующее одинаково не найдено** — 404 и там, и там.
 */
describe('AccentAntiHabitDomainService: архив и удаление', () => {
  /** Строка-образец. */
  const row = (over: Partial<AntiHabitFull> = {}): AntiHabitFull =>
    ({
      id: 'ah-1',
      accountId: 'acc-1',
      title: 'Без сахара',
      description: null,
      isActive: true,
      currentAttemptStartedAt: 1_700_000_000_000,
      attemptNumber: 1,
      recordDays: 0,
      recordAttemptStartedAt: null,
      targetDays: null,
      isStarter: false,
      position: 0,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    }) as AntiHabitFull;

  /** Репозиторий-заглушка, запоминающий вызовы. */
  const repositoryOf = (found: AntiHabitFull | null = row()) => {
    const calls: { update: unknown[][]; delete: unknown[][] } = { update: [], delete: [] };
    const repository = {
      findOwned: async (): Promise<AntiHabitFull | null> => found,
      update: async (...args: unknown[]): Promise<AntiHabitFull | null> => {
        calls.update.push(args);
        const patch = args[2] as { isActive?: boolean };
        return found === null ? null : row({ isActive: patch.isActive ?? true });
      },
      delete: async (...args: unknown[]): Promise<boolean> => {
        calls.delete.push(args);
        return found !== null;
      },
    };
    return { repository, calls };
  };

  /** Собирает domain-service с заглушками вместо соседей. */
  const serviceOf = (found: AntiHabitFull | null = row()) => {
    const { repository, calls } = repositoryOf(found);
    const service = new AccentAntiHabitDomainService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 3 } as never,
    );
    return { service, calls };
  };

  it('в архив и обратно — оба перехода работают', async () => {
    const { service, calls } = serviceOf();

    const archived = await service.setArchived('ah-1', 'acc-1', true);
    const restored = await service.setArchived('ah-1', 'acc-1', false);

    expect(archived.isActive).toBe(false);
    expect(restored.isActive).toBe(true);
    expect(calls.update).toHaveLength(2);
    expect(calls.delete).toHaveLength(0);
  });

  it('архив не удаляет, удаление не архивирует', async () => {
    const { service, calls } = serviceOf();

    await service.delete('ah-1', 'acc-1');

    expect(calls.delete).toHaveLength(1);
    expect(calls.update).toHaveLength(0);
  });

  it('чужое и несуществующее — 404 у обеих операций', async () => {
    const { service } = serviceOf(null);

    await expect(service.setArchived('ah-1', 'acc-1', true)).rejects.toBeInstanceOf(
      AntiHabitNotFoundError,
    );
    await expect(service.delete('ah-1', 'acc-1')).rejects.toBeInstanceOf(AntiHabitNotFoundError);
  });
});
