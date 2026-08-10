import { RoleAdminAudienceAdapter } from './role-admin-audience.adapter';
import type { RoleRepositoryPort } from '../../account/adapters/role-repository.port';
import type { TelegramRepositoryPort } from './telegram-repository.port';
import type { TelegramLinkFull } from '../interfaces/telegram-link-full.interface';

/**
 * Тесты «кто в боте админ» (2.9.3·3а).
 *
 * Стерегут границу безопасности: бот умеет выдавать приглашения, поэтому ошибка в эту сторону
 * раздаёт их кому угодно, а в обратную — лишает админа его же бота.
 * 1. чат без привязки — **не админ** (и роли не спрашиваются вовсе);
 * 2. привязан обычный пользователь — **не админ**;
 * 3. привязан аккаунт с ролью `admin` — админ;
 * 4. в список чатов попадают только админы **с привязкой**: админ без Telegram выпадает молча.
 */
describe('RoleAdminAudienceAdapter', () => {
  const linkOf = (accountId: string, chatId: string): TelegramLinkFull =>
    ({ accountId, chatId }) as TelegramLinkFull;

  /** Репозиторий Telegram с заданными привязками. */
  const telegramOf = (links: TelegramLinkFull[]): TelegramRepositoryPort =>
    ({
      findLinkByChat: async (chatId: string) =>
        links.find((link) => link.chatId === chatId) ?? null,
      findLinkByAccount: async (accountId: string) =>
        links.find((link) => link.accountId === accountId) ?? null,
    }) as unknown as TelegramRepositoryPort;

  /** Репозиторий ролей: кто какие роли имеет. */
  const rolesOf = (map: Record<string, string[]>): RoleRepositoryPort =>
    ({
      codesOf: async (accountId: string) => map[accountId] ?? [],
      accountIdsByRoleCode: async (code: string) =>
        Object.entries(map)
          .filter(([, codes]) => codes.includes(code))
          .map(([accountId]) => accountId),
    }) as unknown as RoleRepositoryPort;

  it('чат без привязки — не админ', async () => {
    const adapter = new RoleAdminAudienceAdapter(rolesOf({ 'acc-1': ['admin'] }), telegramOf([]));
    await expect(adapter.isAdminChat('999')).resolves.toBe(false);
  });

  it('привязан обычный пользователь — не админ', async () => {
    const adapter = new RoleAdminAudienceAdapter(
      rolesOf({ 'acc-1': ['user'] }),
      telegramOf([linkOf('acc-1', '111')]),
    );
    await expect(adapter.isAdminChat('111')).resolves.toBe(false);
  });

  it('привязан аккаунт с ролью admin — админ', async () => {
    const adapter = new RoleAdminAudienceAdapter(
      rolesOf({ 'acc-1': ['user', 'admin'] }),
      telegramOf([linkOf('acc-1', '111')]),
    );
    await expect(adapter.isAdminChat('111')).resolves.toBe(true);
  });

  it('в список чатов попадают только админы с привязкой', async () => {
    const adapter = new RoleAdminAudienceAdapter(
      rolesOf({ 'acc-1': ['admin'], 'acc-2': ['admin'], 'acc-3': ['user'] }),
      telegramOf([linkOf('acc-1', '111'), linkOf('acc-3', '333')]),
    );
    // acc-2 — админ без Telegram, acc-3 — привязан, но не админ.
    await expect(adapter.adminChatIds()).resolves.toEqual(['111']);
  });

  it('админов с привязкой нет — пустой список, а не исключение', async () => {
    const adapter = new RoleAdminAudienceAdapter(rolesOf({}), telegramOf([]));
    await expect(adapter.adminChatIds()).resolves.toEqual([]);
  });
});
