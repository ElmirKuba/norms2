import { NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { RoleRepositoryPort } from '../../modules/account/adapters/role-repository.port';

/**
 * Тесты `RolesGuard` (2.9.3·3) — **первый тест в проекте**.
 *
 * Проверяется здесь не «работает ли Nest», а три наших решения, каждое из которых легко
 * сломать незаметно:
 * 1. отказ отдаётся как **404**, а не 403 — иначе перебор адресов рисует карту админки;
 * 2. роль читается **из базы на каждом запросе** — иначе снятый админ остаётся админом до
 *    истечения токена;
 * 3. хватает **одной** из перечисленных ролей — они складываются, а не вкладываются.
 */
describe('RolesGuard', () => {
  const account = { id: 'acc-1' };

  /** Собирает контекст с заданными метаданными и аккаунтом. */
  const contextOf = (withAccount: boolean): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => (withAccount ? { account } : {}),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  /** Reflector, всегда возвращающий заданные роли. */
  const reflectorOf = (roles: string[] | undefined): Reflector =>
    ({ getAllAndOverride: () => roles }) as unknown as Reflector;

  /** Репозиторий, отдающий заданные коды ролей. */
  const repositoryOf = (codes: string[]): RoleRepositoryPort =>
    ({ codesOf: async () => codes }) as unknown as RoleRepositoryPort;

  it('пропускает роут без декоратора ролей', async () => {
    const guard = new RolesGuard(reflectorOf(undefined), repositoryOf([]));
    await expect(guard.canActivate(contextOf(true))).resolves.toBe(true);
  });

  it('пропускает, когда требуемая роль есть', async () => {
    const guard = new RolesGuard(reflectorOf(['admin']), repositoryOf(['user', 'admin']));
    await expect(guard.canActivate(contextOf(true))).resolves.toBe(true);
  });

  it('хватает ОДНОЙ роли из перечисленных', async () => {
    const guard = new RolesGuard(reflectorOf(['admin', 'moderator']), repositoryOf(['moderator']));
    await expect(guard.canActivate(contextOf(true))).resolves.toBe(true);
  });

  it('сверяет код роли без учёта регистра', async () => {
    const guard = new RolesGuard(reflectorOf(['ADMIN']), repositoryOf(['admin']));
    await expect(guard.canActivate(contextOf(true))).resolves.toBe(true);
  });

  it('отдаёт 404, а не 403, когда роли не хватает', async () => {
    const guard = new RolesGuard(reflectorOf(['admin']), repositoryOf(['user']));
    await expect(guard.canActivate(contextOf(true))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('отдаёт 404, когда аутентификации не было вовсе', async () => {
    const guard = new RolesGuard(reflectorOf(['admin']), repositoryOf(['admin']));
    await expect(guard.canActivate(contextOf(false))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('спрашивает роли у репозитория на КАЖДОМ запросе, а не берёт из токена', async () => {
    const codesOf = jest.fn<Promise<string[]>, [string]>().mockResolvedValue(['admin']);
    const repository = { codesOf } as unknown as RoleRepositoryPort;
    const guard = new RolesGuard(reflectorOf(['admin']), repository);

    await guard.canActivate(contextOf(true));
    await guard.canActivate(contextOf(true));

    expect(codesOf).toHaveBeenCalledTimes(2);
    expect(codesOf).toHaveBeenCalledWith(account.id);
  });
});
