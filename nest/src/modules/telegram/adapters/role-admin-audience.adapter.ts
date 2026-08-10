import { Inject, Injectable } from '@nestjs/common';
import { ROLE_REPOSITORY } from '../../account/adapters/role-repository.port';
import type { RoleRepositoryPort } from '../../account/adapters/role-repository.port';
import { TELEGRAM_REPOSITORY } from './telegram-repository.port';
import type { TelegramRepositoryPort } from './telegram-repository.port';
import type { AdminAudiencePort } from './admin-audience.port';

/** Код роли администратора. */
const ROLE_ADMIN = 'admin';

/**
 * Реализация «кто в боте админ» через роли аккаунта (2.9.3·3а).
 *
 * Путь всегда один и тот же: `chat_id` → привязка (`telegram_links`) → аккаунт → роли. Он
 * однозначен, потому что привязка уникальна с обеих сторон (один аккаунт ↔ один чат) — это
 * заложено ещё в 2.9.1·8.
 *
 * **Конкретика живёт здесь, а не в домене.** Доменный сервис и use-case знают только порт, так
 * что «кого считать админом» меняется правкой одного класса.
 */
@Injectable()
export class RoleAdminAudienceAdapter implements AdminAudiencePort {
  /**
   * @param _roleRepository Порт репозитория ролей (чужая область, зависимость идёт вниз).
   * @param _telegramRepository Порт репозитория Telegram — привязки чатов.
   */
  public constructor(
    @Inject(ROLE_REPOSITORY) private readonly _roleRepository: RoleRepositoryPort,
    @Inject(TELEGRAM_REPOSITORY) private readonly _telegramRepository: TelegramRepositoryPort,
  ) {}

  /**
   * Админ ли пишет из этого чата.
   * @param chatId Идентификатор чата.
   * @returns Признак админа.
   */
  public async isAdminChat(chatId: string): Promise<boolean> {
    const link = await this._telegramRepository.findLinkByChat(chatId);
    if (link === null) {
      return false;
    }
    const codes = await this._roleRepository.codesOf(link.accountId);
    return codes.includes(ROLE_ADMIN);
  }

  /**
   * Чаты всех админов, привязавших Telegram.
   *
   * Аккаунт без привязки просто выпадает из списка: он админ в продукте, но в боте его нет.
   *
   * @returns Идентификаторы чатов.
   */
  public async adminChatIds(): Promise<string[]> {
    const accountIds = await this._roleRepository.accountIdsByRoleCode(ROLE_ADMIN);
    const chatIds: string[] = [];
    for (const accountId of accountIds) {
      const link = await this._telegramRepository.findLinkByAccount(accountId);
      if (link !== null) {
        chatIds.push(link.chatId);
      }
    }
    return chatIds;
  }
}
