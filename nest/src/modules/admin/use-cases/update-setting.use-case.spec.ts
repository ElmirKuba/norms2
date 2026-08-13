import { NotFoundException } from '@nestjs/common';
import { ValidationError } from '../../../shared/errors/validation.error';
import { UpdateSettingUseCase } from './update-setting.use-case';
import { SETTING_TELEGRAM_BOT_PAUSED } from '../../settings/domain-services/settings.domain-service';
import type { SettingsDomainService } from '../../settings/domain-services/settings.domain-service';
import type { SettingActor } from '../../settings/interfaces/setting-actor.interface';

/**
 * Тесты изменения настройки из админки (2.9.3·7).
 *
 * Стерегут три решения, каждое из которых легко «упростить» и не заметить последствий:
 * 1. ключ вне белого списка — **404**, а не запись новой настройки: иначе опечатка заводила бы
 *    ключ, которого никто не читает;
 * 2. значение не того типа — **400**, а не «сохраним строку как есть»;
 * 3. **логин админа доходит до записи** — без него человеческое действие выглядит в журнале
 *    системным (ровно этот дефект и поймала живая проверка 10.08.2026).
 */
describe('UpdateSettingUseCase', () => {
  const actor: SettingActor = { accountId: 'acc-1', login: 'elmir_kuba' };

  /** Доменный сервис-заглушка, запоминающий вызов. */
  const settingsOf = (): { service: SettingsDomainService; calls: unknown[][] } => {
    const calls: unknown[][] = [];
    const service = {
      setBoolean: async (...args: unknown[]): Promise<void> => {
        calls.push(args);
      },
      describeAll: async () => [
        {
          key: SETTING_TELEGRAM_BOT_PAUSED,
          value: 'true',
          source: 'db' as const,
          updatedBy: 'acc-1',
          updatedAt: new Date(),
        },
      ],
    } as unknown as SettingsDomainService;
    return { service, calls };
  };

  it('незнакомый ключ — 404, а не новая настройка', async () => {
    const { service, calls } = settingsOf();
    const useCase = new UpdateSettingUseCase(service);

    await expect(useCase.execute('what.ever', 'true', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(calls).toHaveLength(0);
  });

  it('значение не булево — 400, запись не происходит', async () => {
    const { service, calls } = settingsOf();
    const useCase = new UpdateSettingUseCase(service);

    await expect(
      useCase.execute(SETTING_TELEGRAM_BOT_PAUSED, 'да', actor),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it('логин админа доходит до записи — иначе журнал припишет действие системе', async () => {
    const { service, calls } = settingsOf();
    const useCase = new UpdateSettingUseCase(service);

    await useCase.execute(SETTING_TELEGRAM_BOT_PAUSED, 'true', actor);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBe(true);
    expect(calls[0]?.[2]).toEqual(actor);
  });

  it('ключ приводится к нижнему регистру, а не считается другим', async () => {
    const { service, calls } = settingsOf();
    const useCase = new UpdateSettingUseCase(service);

    await useCase.execute(SETTING_TELEGRAM_BOT_PAUSED.toUpperCase(), 'false', actor);

    expect(calls[0]?.[0]).toBe(SETTING_TELEGRAM_BOT_PAUSED);
  });
});
