import { Injectable, Logger } from '@nestjs/common';
import { TelegramDomainService } from '../domain-services/telegram.domain-service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import { decisionButtons, escapeHtml } from '../domain-services/telegram.domain-service';

/** Нейтральный ответ — когда логин чужой (см. комментарий класса). */
const SAME_ANSWER =
  'Заявка отправлена. Если аккаунт с таким логином забанен, её увидят и ответят здесь же.';

/**
 * Просьба снять бан через бота (2.9.3·22).
 *
 * **Ответ зависит от того, свой логин или чужой** (уточнено Elmir 14.08.2026).
 *
 * По **чужому** логину бот отвечает одинаково всегда — существует он, забанен ли и создалась ли
 * заявка: иначе бот превращается в перебиратель чужих логинов. Заявка при этом заводится только
 * когда есть кого разбанивать, поэтому админ не разгребает мусор.
 *
 * По **своему** (чат привязан к этому аккаунту) молчать не о чем: человек и так знает, кто он.
 * Тут бот говорит прямо — «ты не забанен, заявка не нужна» или «заявка отправлена». Обещать
 * отправку того, чего не отправлял, — худшее из двух зол: человек ждёт ответа, которого не будет.
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
   * @param appeal Его объяснение «почему стоит снять бан» — без него решать нечего.
   * @returns Промис завершения.
   */
  public async submit(chatId: string, login: string, appeal: string): Promise<void> {
    const account = await this._accounts.getPublicByLogin(login.trim());
    // Свой ли это логин: чат привязан именно к этому аккаунту.
    const linkedId = await this._telegram.findAccountByChat(chatId);
    const own = account !== null && linkedId === account.id;

    if (account === null) {
      await this._telegram.reply(chatId, SAME_ANSWER);
      return;
    }

    const bans = await this._bans.listActiveAgainst(account.id);
    if (bans.length === 0) {
      await this._telegram.reply(
        chatId,
        own
          ? '✅ Твой аккаунт не забанен — заявка не нужна и отправлена не будет.'
          : SAME_ANSWER,
      );
      return;
    }

    const card = [
      '<b>Просит снять бан</b>',
      '',
      `Логин: @${account.login}`,
      `Активных банов: ${String(bans.length)}`,
      '',
      `За что банили: ${bans.map((ban) => ban.reason).join(' · ')}`,
      '',
      `<b>Его объяснение:</b> ${escapeHtml(appeal)}`,
    ].join('\n');

    await this._telegram.submitRequest({
      chatId,
      type: 'unban',
      accountId: account.id,
      cardText: card,
      buttons: decisionButtons,
    });
    this._logger.log(`Заявка на разбан: ${account.login}, активных банов ${String(bans.length)}`);
    await this._telegram.reply(
      chatId,
      own
        ? 'Заявка отправлена — её увидят и ответят здесь же.'
        : SAME_ANSWER,
    );
  }
}
