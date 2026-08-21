import { AccentTodoDomainService } from './accent-todo.domain-service';
import { TodoNotFoundError } from '../../../../shared/errors/todo-not-found.error';
import { TodoEventNotFoundError } from '../../../../shared/errors/todo-event-not-found.error';
import { TodoMaxDepthReachedError } from '../../../../shared/errors/todo-max-depth-reached.error';
import { ValidationError } from '../../../../shared/errors/validation.error';
import type { TodoFull } from '../interfaces/todo-full.interface';
import type { TodoEventFull } from '../interfaces/todo-event-full.interface';

/**
 * Бизнес-правила «Дел» (2.10·E7).
 *
 * **Почему именно эти пять правил.** Каждое уже ломалось руками или держится на честном слове:
 *
 * 1. **глубина** — вложенность объявлена трёхуровневой, а работала двухуровневой (поймано
 *    17.08.2026): показывали только прямых детей корня;
 * 2. **чужое = не найдено** — единственная защита владельца; ошибка здесь не роняет приложение,
 *    а тихо открывает чужие записи;
 * 3. **освобождение по событию** — механика, которой нет у платных конкурентов, и она держится
 *    на одном вызове, который легко потерять при рефакторинге;
 * 4. **удаление события снимает ожидание ДО удаления** — иначе в делах остаётся ссылка на
 *    несуществующее событие, тот самый ярлык-призрак из 2.9.3;
 * 5. **пустой заголовок** — единственное обязательное поле; проверка его чистит.
 *
 * Тесты на domain-service, а не на HTTP: правила живут здесь, и проверять их через контроллер
 * значило бы заодно тестировать guard, DTO и роутер — то есть на каждое правило чинить три чужих
 * поломки.
 */
describe('AccentTodoDomainService: правила списков дел', () => {
  /** Запись-образец. */
  const row = (over: Partial<TodoFull> = {}): TodoFull =>
    ({
      id: 'todo-1',
      accountId: 'acc-1',
      parentId: null,
      kind: 'deed',
      title: 'Сходить в МФЦ',
      note: null,
      status: 'open',
      completedAt: null,
      plannedOn: null,
      waitsForEventId: null,
      waitsUntil: null,
      badge: null,
      archivedAt: null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    }) as TodoFull;

  /** Событие-образец. */
  const event = (over: Partial<TodoEventFull> = {}): TodoEventFull =>
    ({
      id: 'ev-1',
      accountId: 'acc-1',
      title: 'Приедет посылка',
      expectedOn: null,
      happenedAt: null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    }) as TodoEventFull;

  /**
   * Репозиторий-заглушка: хранит дерево в памяти и запоминает порядок вызовов.
   * @param tree Записи, которые «лежат в базе».
   * @param events События справочника.
   * @returns Сервис, журнал вызовов и сам репозиторий.
   */
  const serviceOf = (tree: TodoFull[] = [row()], events: TodoEventFull[] = []) => {
    const calls: string[] = [];
    const repository = {
      findOwned: async (id: string, accountId: string): Promise<TodoFull | null> =>
        tree.find((item) => item.id === id && item.accountId === accountId) ?? null,
      findOwnedEvent: async (id: string, accountId: string): Promise<TodoEventFull | null> =>
        events.find((item) => item.id === id && item.accountId === accountId) ?? null,
      create: async (data: { title: string }): Promise<TodoFull> => {
        calls.push('create');
        return row({ title: data.title });
      },
      update: async (id: string, accountId: string): Promise<TodoFull | null> =>
        tree.find((item) => item.id === id && item.accountId === accountId) ?? null,
      setDone: async (id: string, accountId: string): Promise<TodoFull | null> =>
        tree.find((item) => item.id === id && item.accountId === accountId) ?? null,
      setArchived: async (
        id: string,
        accountId: string,
        archived: boolean,
      ): Promise<TodoFull | null> => {
        const found = tree.find((item) => item.id === id && item.accountId === accountId);
        return found ? row({ ...found, archivedAt: archived ? new Date() : null }) : null;
      },
      delete: async (id: string, accountId: string): Promise<boolean> => {
        calls.push('delete');
        return tree.some((item) => item.id === id && item.accountId === accountId);
      },
      setEventHappened: async (id: string, accountId: string): Promise<TodoEventFull | null> => {
        calls.push('setEventHappened');
        return events.find((item) => item.id === id && item.accountId === accountId) ?? null;
      },
      releaseWaiting: async (): Promise<number> => {
        calls.push('releaseWaiting');
        return 2;
      },
      deleteEvent: async (id: string, accountId: string): Promise<boolean> => {
        calls.push('deleteEvent');
        return events.some((item) => item.id === id && item.accountId === accountId);
      },
      listByKind: async (): Promise<TodoFull[]> => tree.filter((item) => item.parentId === null),
      listChildren: async (_accountId: string, parentIds: string[]): Promise<TodoFull[]> => {
        calls.push(`listChildren:${parentIds.join(',')}`);
        return tree.filter((item) => item.parentId !== null && parentIds.includes(item.parentId));
      },
    };
    return { service: new AccentTodoDomainService(repository as never), calls };
  };

  describe('глубина вложенности', () => {
    // Дерево на три уровня: корень → ребёнок → внук.
    const deep = [
      row({ id: 'l1', parentId: null }),
      row({ id: 'l2', parentId: 'l1' }),
      row({ id: 'l3', parentId: 'l2' }),
    ];

    it('разрешает второй уровень', async () => {
      const { service } = serviceOf(deep);
      await expect(
        service.create({ accountId: 'acc-1', kind: 'deed', title: 'Оплатить пошлину', parentId: 'l1' } as never),
      ).resolves.toBeDefined();
    });

    it('разрешает третий уровень', async () => {
      const { service } = serviceOf(deep);
      await expect(
        service.create({ accountId: 'acc-1', kind: 'deed', title: 'Взять квитанцию', parentId: 'l2' } as never),
      ).resolves.toBeDefined();
    });

    it('отказывает на четвёртом', async () => {
      const { service } = serviceOf(deep);
      await expect(
        service.create({ accountId: 'acc-1', kind: 'deed', title: 'Слишком глубоко', parentId: 'l3' } as never),
      ).rejects.toBeInstanceOf(TodoMaxDepthReachedError);
    });

    it('чужой родитель — не найден, а не «нельзя глубже»', async () => {
      const { service } = serviceOf(deep);
      await expect(
        service.create({ accountId: 'acc-2', kind: 'deed', title: 'Чужое', parentId: 'l1' } as never),
      ).rejects.toBeInstanceOf(TodoNotFoundError);
    });

    it('список спускается на все три уровня, а не только к прямым детям', async () => {
      const { service, calls } = serviceOf(deep);
      const { children } = await service.list('acc-1', null, false);
      expect(children.map((item) => item.id)).toEqual(['l2', 'l3']);
      // Ровно два дозапроса: по одному на уровень ниже корня, а не по запросу на запись.
      expect(calls.filter((call) => call.startsWith('listChildren'))).toEqual([
        'listChildren:l1',
        'listChildren:l2',
      ]);
    });
  });

  describe('чужое не находится', () => {
    it('обновление чужой записи — 404', async () => {
      const { service } = serviceOf();
      await expect(service.update('todo-1', 'acc-2', { title: 'Взлом' })).rejects.toBeInstanceOf(
        TodoNotFoundError,
      );
    });

    it('отметка чужой записи — 404', async () => {
      const { service } = serviceOf();
      await expect(service.setDone('todo-1', 'acc-2', true)).rejects.toBeInstanceOf(
        TodoNotFoundError,
      );
    });

    it('архив чужой записи — 404', async () => {
      const { service } = serviceOf();
      await expect(service.setArchived('todo-1', 'acc-2', true)).rejects.toBeInstanceOf(
        TodoNotFoundError,
      );
    });

    it('удаление чужой записи — 404', async () => {
      const { service } = serviceOf();
      await expect(service.delete('todo-1', 'acc-2')).rejects.toBeInstanceOf(TodoNotFoundError);
    });

    it('нельзя привязать ожидание к чужому событию', async () => {
      const { service } = serviceOf([row()], [event({ accountId: 'acc-9' })]);
      // Именно «не найдено», а не «ошибка данных»: ответ не должен подтверждать, что такое
      // событие вообще существует у кого-то. JSDoc обещал здесь ValidationError — тест это
      // расхождение и вскрыл, поправлена дока, а не поведение.
      await expect(
        service.create({
          accountId: 'acc-1',
          kind: 'deed',
          title: 'Ждать чужого',
          waitsForEventId: 'ev-1',
        } as never),
      ).rejects.toBeInstanceOf(TodoEventNotFoundError);
    });
  });

  describe('архив и восстановление', () => {
    it('оба перехода существуют — вход и выход', async () => {
      const { service } = serviceOf();
      const archived = await service.setArchived('todo-1', 'acc-1', true);
      expect(archived.archivedAt).not.toBeNull();
      const restored = await service.setArchived('todo-1', 'acc-1', false);
      expect(restored.archivedAt).toBeNull();
    });
  });

  describe('освобождение по событию', () => {
    it('состоявшееся событие снимает ожидание с дел', async () => {
      const { service, calls } = serviceOf([row()], [event()]);
      const result = await service.setEventHappened('ev-1', 'acc-1', true);
      expect(result.released).toBe(2);
      expect(calls).toContain('releaseWaiting');
    });

    it('снятие отметки «состоялось» ничего не освобождает', async () => {
      const { service, calls } = serviceOf([row()], [event({ happenedAt: new Date() })]);
      const result = await service.setEventHappened('ev-1', 'acc-1', false);
      expect(result.released).toBe(0);
      expect(calls).not.toContain('releaseWaiting');
    });

    it('чужое событие не отмечается', async () => {
      const { service } = serviceOf([row()], [event({ accountId: 'acc-9' })]);
      await expect(service.setEventHappened('ev-1', 'acc-2', true)).rejects.toBeInstanceOf(
        TodoEventNotFoundError,
      );
    });

    it('удаление события снимает ожидание ДО удаления, а не после', async () => {
      const { service, calls } = serviceOf([row()], [event()]);
      await service.deleteEvent('ev-1', 'acc-1');
      // Порядок — суть правила: удали мы сначала событие, в делах осталась бы ссылка на то,
      // чего больше нет.
      expect(calls.indexOf('releaseWaiting')).toBeLessThan(calls.indexOf('deleteEvent'));
    });
  });

  describe('заголовок', () => {
    it('пустой заголовок не принимается', async () => {
      const { service } = serviceOf();
      await expect(
        service.create({ accountId: 'acc-1', kind: 'deed', title: '   ' } as never),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('края обрезаются, и запись создаётся', async () => {
      const { service } = serviceOf();
      const created = await service.create({
        accountId: 'acc-1',
        kind: 'deed',
        title: '  Купить радиатор  ',
      } as never);
      expect(created.title).toBe('Купить радиатор');
    });

    it('обновление пустым заголовком отбивается до похода в базу', async () => {
      const { service, calls } = serviceOf();
      await expect(service.update('todo-1', 'acc-1', { title: '  ' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(calls).toEqual([]);
    });
  });
});
