import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { DeleteReleaseUseCase } from '../use-cases/delete-release.use-case';
import { ManageReleasesUseCase } from '../use-cases/manage-releases.use-case';
import { ValidationError } from '../../../shared/errors/validation.error';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { ReleaseFull } from '../../notifications/interfaces/release-full.interface';
import type { NotificationContentFormat } from '../../notifications/interfaces/notification-pure.interface';

/** Тело запроса на создание публикации. */
interface CreateReleaseBody {
  /** Публичный ключ (`release-2.9.3`). */
  key: string;
  /** Заголовок. */
  title: string;
  /** Путь к `.md` относительно папки контента; не нужен у ноты-страницы. */
  contentFile?: string | null;
  /** Чем является содержимое: текст `.md` или страница фронта. */
  contentFormat: NotificationContentFormat;
  /** Дата выпуска (ISO) или пусто — тогда «сейчас». */
  publishedAt?: string;
}

/**
 * Публикации релизов из админки (`/api/v1/admin/releases`, 2.9.3·7).
 *
 * ⚠️ **Удаление необратимо и видно людям:** нота исчезает из колокольчиков вместе с отметками
 * «прочитано». Пост в Telegram при этом остаётся — id постов канала нигде не хранятся, и бот их
 * удалять не умеет.
 */
@Controller('admin/releases')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminReleasesController {
  /**
   * @param _deleteReleaseUseCase Удаление публикации.
   * @param _manageReleasesUseCase Список, создание и вещание (2.9.3·13).
   */
  public constructor(
    private readonly _deleteReleaseUseCase: DeleteReleaseUseCase,
    private readonly _manageReleasesUseCase: ManageReleasesUseCase,
  ) {}

  /**
   * Все публикации, новые сверху — с датой вещания, которой нет у витрины.
   * @returns Полные строки.
   */
  @Get()
  public async list(): Promise<ReleaseFull[]> {
    return this._manageReleasesUseCase.list();
  }

  /**
   * Регистрирует публикацию и её доставку в колокольчики. **В канал ничего не уходит** —
   * вещание отдельной кнопкой.
   * @param body Поля публикации.
   * @param request Запрос (аккаунт из Guard).
   * @returns Созданная публикация.
   */
  @Post()
  public async create(
    @Body() body: CreateReleaseBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<ReleaseFull> {
    return this._manageReleasesUseCase.create(
      {
        key: body.key ?? '',
        title: body.title ?? '',
        contentFile: body.contentFile ?? null,
        contentFormat: body.contentFormat,
        publishedAt: this._publishedAt(body.publishedAt),
      },
      { accountId: request.account.id, login: request.account.login },
    );
  }

  /**
   * Объявляет релиз в канал. Повтор → 409: канал не должен получать пост дважды.
   * @param key Публичный ключ.
   * @param request Запрос (аккаунт из Guard).
   * @returns Дата вещания и признак доставки.
   */
  @Post(':key/broadcast')
  public async broadcast(
    @Param('key') key: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ broadcastedAt: Date | null; sent: boolean }> {
    const outcome = await this._manageReleasesUseCase.broadcast(key, {
      accountId: request.account.id,
      login: request.account.login,
    });
    return { broadcastedAt: outcome.release.broadcastedAt, sent: outcome.sent };
  }

  /**
   * Разбирает дату выпуска из тела запроса.
   * @param value Строка ISO или undefined.
   * @returns Дата или null (тогда «сейчас»).
   * @throws {ValidationError} Если строка не разбирается в дату.
   */
  private _publishedAt(value?: string): Date | null {
    if (value === undefined || value.trim() === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError('Дата выпуска не разобралась — ожидается ISO-строка.');
    }
    return parsed;
  }

  /**
   * Удаляет публикацию вместе с доставкой и отметками прочтения.
   * @param key Публичный ключ (`release-2.9.2`).
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Delete(':key')
  @HttpCode(204)
  public async remove(
    @Param('key') key: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._deleteReleaseUseCase.execute(key, request.account.id, request.account.login);
  }
}
