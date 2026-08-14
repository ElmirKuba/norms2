import { Inject, Injectable, Logger } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { TELEGRAM_API } from '../adapters/telegram-api.port';
import { TELEGRAM_REPOSITORY } from '../adapters/telegram-repository.port';
import {
  grantButtons,
  renderInvitesCard,
  TelegramDomainService,
} from '../domain-services/telegram.domain-service';
import type { AccountFull } from '../../account/interfaces/account-full.interface';
import type { TelegramApiPort } from '../adapters/telegram-api.port';
import type { TelegramRepositoryPort } from '../adapters/telegram-repository.port';

/** Что ответить, когда чат не привязан ни к какому аккаунту. */
const NOT_LINKED = [
  'Этот чат не привязан к аккаунту «Нормисов», а приглашения начисляются аккаунту — по словам начислять нельзя.',
  '',
  'Привязка живёт в личном кабинете: <b>Настройки → Telegram</b>.',
].join('\n');

/**
 * Просьба о дополнительных приглашениях (2.9.1·13) — гостевая половина сценария.
 *
 * Живёт в use-case, а не в domain-service, ровно по одной причине: ей нужен **чужой домен**
 * (`account` — логин и остаток квоты), а кросс-доменные вызовы разрешены только вниз и только
 * отсюда (CLAUDE.md, правила зависимостей). Диалог как таковой по-прежнему ведёт
 * `TelegramDomainService`, здесь — только то, что упирается в аккаунт.
 */
@Injectable()
export class RequestInvitesUseCase {
  private readonly _logger = new Logger('TelegramInvites');

  /**
   * @param _repository Порт репозитория заявок и привязок.
   * @param _api Исходящий порт Bot API.
   * @param _telegramDomainService Domain-service Telegram-области (диалог и доставка).
   * @param _accountDomainService Domain-service аккаунтов (логин, квота).
   */
  public constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly _repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_API) private readonly _api: TelegramApiPort,
    private readonly _telegramDomainService: TelegramDomainService,
    private readonly _accountDomainService: AccountDomainService,
  ) {}

  /**
   * Начинает анкету, если чат привязан к живому аккаунту.
   * @param chatId Чат заявителя.
   * @returns Промис завершения.
   */
  public async start(chatId: string): Promise<void> {
    const account = await this._resolveAccount(chatId);
    if (account === null) {
      return;
    }
    await this._telegramDomainService.startInvites(chatId);
  }

  /**
   * Отправляет собранную просьбу админу.
   * @param chatId Чат заявителя.
   * @param purpose Что человек написал.
   * @returns Промис завершения.
   */
  public async submit(chatId: string, purpose: string): Promise<void> {
    // Аккаунт перечитывается, а не берётся с начала диалога: между вопросом и ответом человек
    // мог отвязать чат или удалить аккаунт, и начислять тогда некому.
    const account = await this._resolveAccount(chatId);
    if (account === null) {
      return;
    }
    await this._telegramDomainService.submitRequest({
      chatId,
      type: 'more_invites',
      accountId: account.id,
      cardText: renderInvitesCard(account.login, account.invitesRemaining, purpose),
      buttons: grantButtons,
    });
  }

  /**
   * Находит аккаунт, привязанный к чату, и объясняет человеку, если его нет.
   * @param chatId Чат.
   * @returns Аккаунт или null (человеку уже отвечено).
   */
  private async _resolveAccount(chatId: string): Promise<AccountFull | null> {
    const link = await this._repository.findLinkByChat(chatId);
    if (link === null) {
      await this._api.sendMessage(chatId, NOT_LINKED);
      return null;
    }
    const account = await this._accountDomainService.getActiveById(link.accountId).catch(() => null);
    if (account === null) {
      // Привязка есть, аккаунта нет: удалён или деактивирован. Молчать нельзя — человек ждёт
      // ответа на нажатую кнопку.
      this._logger.warn(`Привязка чата ${chatId} указывает на недоступный аккаунт.`);
      await this._api.sendMessage(
        chatId,
        'Привязанный аккаунт сейчас недоступен. Зайди в личный кабинет и привяжи чат заново.',
      );
      return null;
    }
    return account;
  }
}
