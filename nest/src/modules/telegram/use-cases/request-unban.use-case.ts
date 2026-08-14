import { Injectable, Logger } from '@nestjs/common';
import { TelegramDomainService } from '../domain-services/telegram.domain-service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import { decisionButtons } from '../domain-services/telegram.domain-service';

/** Ответ человеку — один и тот же при любом исходе (см. комментарий класса). */
const SAME_ANSWER =
  'Заявка отправлена. Если аккаунт с таким логином забанен, её увидят и ответят здесь же.';

/**
 * Просьба снять бан через бота (2.9.3·22).
 *
 * **Ответ человеку одинаков при любом исходе — и это защита, а не небрежность.** Бот отвечает
 * то же самое, существует ли такой логин, забанен ли он и создалась ли заявка. Иначе бот
 * превращается в перебиратель чужих логинов: спросил — узнал, есть ли такой человек и в бане ли
 * он. Заявка при этом создаётся только когда есть кого разбанивать, поэтому админ не разгребает
 * мусор.
 *
 * Кросс-домен идёт вниз: use-case зовёт `account` (найти по логину) и `bans` (есть ли активный
 * бан), но ни одна из этих областей про Telegram не знает.
 */
@Injectable()
export class RequestUnbanUseCase {
  private readonly _logger = new Logger('TelegramUnban');

  /**
   * @param _telegram Гостевой сценарий бота.
   * @param _accounts Аккаунты (поиск по логину).
   * @param _bans Баны (есть ли активные).
   */
  public constructor(
    private readonly _telegram: TelegramDomainService,
    private readonly _accounts: AccountDomainService,
    private readonly _bans: BanDomainService,
  ) {}

  /**
   * Принимает логин из анкеты и заводит заявку, если есть по чему.
   * @param chatId Чат заявителя.
   * @param login Логин, который назвал человек.
   * @returns Промис завершения.
   */
  public async submit(chatId: string, login: string): Promise<void> {
    const account = await this._accounts.getPublicByLogin(login.trim());
    if (account === null) {
      await this._telegram.reply(chatId, SAME_ANSWER);
      return;
    }

    const bans = await this._bans.listActiveAgainst(account.id);
    if (bans.length === 0) {
      await this._telegram.reply(chatId, SAME_ANSWER);
      return;
    }

    const card = [
      '<b>Просит снять бан</b>',
      '',
      `Логин: @${account.login}`,
      `Активных банов: ${String(bans.length)}`,
      '',
      `За что: ${bans.map((ban) => ban.reason).join(' · ')}`,
    ].join('\n');

    await this._telegram.submitRequest({
      chatId,
      type: 'unban',
      accountId: account.id,
      cardText: card,
      buttons: decisionButtons,
    });
    this._logger.log(`Заявка на разбан: ${account.login}, активных банов ${String(bans.length)}`);
    await this._telegram.reply(chatId, SAME_ANSWER);
  }
}
