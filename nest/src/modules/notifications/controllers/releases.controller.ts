import { Controller, Get, Param } from '@nestjs/common';
import { ListPublicReleasesUseCase } from '../use-cases/list-public-releases.use-case';
import { GetPublicReleaseUseCase } from '../use-cases/get-public-release.use-case';
import type { ReleaseView } from '../interfaces/release-view.interface';

/**
 * Публичная витрина релизов (`/api/v1/releases`) — **без `AuthGuard`, намеренно**
 * ([ADR-0064 §5](../../../../docs/decisions/0064-telegram-release-channel.md)).
 *
 * Почему открыто: текст релиз-ноты и так публичен — `.md` отдаётся из `content/` без токена.
 * Закрыт был только API центра уведомлений, потому что он адресный. Витрина адресности не имеет.
 *
 * Чего здесь нет и не должно появиться:
 * - **отметок о прочтении.** Ни один эндпоинт не трогает `notification_reads`: иначе чтение
 *   снаружи начало бы влиять на счётчик непрочитанного в чьём-то личном кабинете;
 * - **персональных уведомлений.** Выборка ограничена `kind = 'release'` на уровне репозитория,
 *   а не фильтром в контроллере — чтобы забыть фильтр было негде.
 *
 * Сюда ведёт ссылка из поста в Telegram-канале: пост несёт тезисы, подробности — здесь.
 */
@Controller('releases')
export class ReleasesController {
  /**
   * @param _listPublicReleasesUseCase Список релизов.
   * @param _getPublicReleaseUseCase Одна нота по ключу.
   */
  public constructor(
    private readonly _listPublicReleasesUseCase: ListPublicReleasesUseCase,
    private readonly _getPublicReleaseUseCase: GetPublicReleaseUseCase,
  ) {}

  /**
   * Все релизные ноты, новые сверху.
   * @returns Проекции витрины.
   */
  @Get()
  public async list(): Promise<ReleaseView[]> {
    return this._listPublicReleasesUseCase.execute();
  }

  /**
   * Одна релизная нота по публичному ключу.
   * @param key Ключ (`release-2.9.0`).
   * @returns Проекция витрины.
   */
  @Get(':key')
  public async byKey(@Param('key') key: string): Promise<ReleaseView> {
    return this._getPublicReleaseUseCase.execute(key);
  }
}
