import { Controller, Get } from '@nestjs/common';
import { GetTelegramPublicUseCase } from '../use-cases/get-telegram-public.use-case';
import type { TelegramPublicView } from '../interfaces/telegram-public-view.interface';

/**
 * Публичные строки Telegram-области (`GET /api/v1/telegram/public`).
 *
 * **Отдельный контроллер от привязки — чтобы граница была видна в структуре, а не в декораторах.**
 * Там каждый метод под `AuthGuard`, здесь нет ни одного, и перепутать при следующей правке
 * труднее: добавляя метод сюда, видишь, что файл целиком публичный.
 *
 * Класть сюда можно **только то, что и так публично** (имя бота, ссылка на него): ручку зовёт
 * страница регистрации, где человек ещё не вошёл.
 */
@Controller('telegram')
export class TelegramPublicController {
  /**
   * @param _publicView Use-case публичных строк.
   */
  public constructor(private readonly _publicView: GetTelegramPublicUseCase) {}

  /**
   * Имя бота и ссылка на него.
   * @returns Публичные строки области.
   */
  @Get('public')
  public view(): TelegramPublicView {
    return this._publicView.execute();
  }
}
