import { Injectable } from '@nestjs/common';
import { TelegramDomainService } from '../domain-services/telegram.domain-service';
import type { TelegramUpdate } from '../interfaces/telegram-update.interface';

/**
 * Use-case обработки апдейта из вебхука (2.9.1·9). Тонкая оркестрация над domain-service.
 */
@Injectable()
export class HandleTelegramUpdateUseCase {
  /**
   * @param _telegramDomainService Domain-service Telegram-области.
   */
  public constructor(private readonly _telegramDomainService: TelegramDomainService) {}

  /**
   * @param update Апдейт.
   * @returns Промис завершения.
   */
  public async execute(update: TelegramUpdate): Promise<void> {
    await this._telegramDomainService.handleUpdate(update);
  }
}
