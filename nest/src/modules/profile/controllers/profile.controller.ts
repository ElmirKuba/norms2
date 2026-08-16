import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AvatarInvalidError } from '../../../shared/errors/avatar-invalid.error';
import { updateAliasSchema } from '../dtos/update-alias.dto';
import { updateTimezoneSchema } from '../dtos/update-timezone.dto';
import type { UpdateTimezoneDto } from '../dtos/update-timezone.dto';
import { UpdateTimezoneUseCase } from '../use-cases/update-timezone.use-case';
import { dismissTimezoneSchema } from '../dtos/dismiss-timezone.dto';
import type { DismissTimezoneDto } from '../dtos/dismiss-timezone.dto';
import { DismissTimezoneUseCase } from '../use-cases/dismiss-timezone.use-case';
import type { UpdateAliasDto } from '../dtos/update-alias.dto';
import { GetMyProfileUseCase } from '../use-cases/get-my-profile.use-case';
import { GetProfileByLoginUseCase } from '../use-cases/get-profile-by-login.use-case';
import { UpdateAliasUseCase } from '../use-cases/update-alias.use-case';
import { DeactivateMyAccountUseCase } from '../use-cases/deactivate-my-account.use-case';
import { DeleteMyAccountUseCase } from '../use-cases/delete-my-account.use-case';
import { UploadAvatarUseCase } from '../use-cases/upload-avatar.use-case';
import type { AvatarUpload } from '../use-cases/upload-avatar.use-case';
import { RemoveAvatarUseCase } from '../use-cases/remove-avatar.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { AccountRead } from '../../account/interfaces/account-read.interface';
import type { AccountPublicView } from '../../account/interfaces/account-public-view.interface';

/**
 * Контроллер профиля (`/api/v1/accounts/*`) — всё под Guard (members-only).
 * `me` — свой полный профиль (`AccountRead`); `:login` — публичная проекция
 * другого участника. Роут `me` объявлен ДО `:login` (статика важнее параметра).
 */
@Controller('accounts')
export class ProfileController {
  /**
   * @param _getProfileByLoginUseCase Публичный профиль по логину.
   * @param _updateAliasUseCase Смена псевдонима.
   * @param _updateTimezoneUseCase Смена часового пояса.
   * @param _dismissTimezoneUseCase Отказ от предложения сменить пояс.
   */
  public constructor(
    private readonly _getMyProfileUseCase: GetMyProfileUseCase,
    private readonly _getProfileByLoginUseCase: GetProfileByLoginUseCase,
    private readonly _updateAliasUseCase: UpdateAliasUseCase,
    private readonly _updateTimezoneUseCase: UpdateTimezoneUseCase,
    private readonly _dismissTimezoneUseCase: DismissTimezoneUseCase,
    private readonly _deactivateMyAccountUseCase: DeactivateMyAccountUseCase,
    private readonly _deleteMyAccountUseCase: DeleteMyAccountUseCase,
    private readonly _uploadAvatarUseCase: UploadAvatarUseCase,
    private readonly _removeAvatarUseCase: RemoveAvatarUseCase,
  ) {}

  /**
   * Свой профиль (из аккаунта, загруженного Guard'ом).
   * @param request Запрос (аккаунт из Guard).
   * @returns Свой профиль без секрета.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  public async getMe(@Req() request: AuthenticatedRequest): Promise<AccountRead> {
    return this._getMyProfileUseCase.execute(request.account);
  }

  /**
   * Меняет свой псевдоним.
   * @param body Тело (alias).
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённый профиль без секрета.
   */
  @Patch('me')
  @UseGuards(AuthGuard)
  public async patchMe(
    @Body(new ZodValidationPipe(updateAliasSchema)) body: UpdateAliasDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AccountRead> {
    return this._updateAliasUseCase.execute(request.account.id, body.alias);
  }

  /**
   * Деактивирует свой аккаунт (обратимая пауза, ADR-0017).
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  /**
   * Меняет часовой пояс (2.10·A2).
   *
   * Отдельная ручка, а не поле в патче профиля: смена сдвигает границу суток, и человек
   * подтверждает её двумя окнами — спрятать такое внутрь «сохранить профиль» значило бы сделать
   * последствие незаметным.
   * @param request Запрос с аккаунтом из Guard.
   * @param body Новая зона.
   * @returns Установленная зона.
   */
  @Post('me/timezone')
  @UseGuards(AuthGuard)
  public async updateTimezone(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(updateTimezoneSchema)) body: UpdateTimezoneDto,
  ): Promise<{ timezone: string }> {
    return this._updateTimezoneUseCase.execute(request.account.id, body.timezone);
  }

  /**
   * Запоминает или забывает зону, про которую человек сказал «не спрашивать» (2.10·A3).
   * @param request Запрос с аккаунтом из Guard.
   * @param body Зона или null.
   * @returns Что запомнили.
   */
  @Post('me/timezone-dismiss')
  @UseGuards(AuthGuard)
  public async dismissTimezone(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(dismissTimezoneSchema)) body: DismissTimezoneDto,
  ): Promise<{ dismissedTimezone: string | null }> {
    return this._dismissTimezoneUseCase.execute(request.account.id, body.timezone);
  }

  @Post('me/deactivate')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async deactivate(@Req() request: AuthenticatedRequest): Promise<void> {
    await this._deactivateMyAccountUseCase.execute(request.account.id);
  }

  /**
   * Удаляет (soft) свой аккаунт (ADR-0017, восстановления нет).
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async deleteMe(@Req() request: AuthenticatedRequest): Promise<void> {
    await this._deleteMyAccountUseCase.execute(request.account.id);
  }

  /**
   * Загружает аватарку (multipart, поле `file`). Тип проверяется по magic-bytes,
   * размер — по `AVATAR_MAX_BYTES`. Хард-кап интерцептора (5 МБ) — защита от OOM.
   * @param file Загруженный файл.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённый профиль без секрета.
   */
  @Post('me/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_242_880 } }))
  public async uploadAvatar(
    @UploadedFile() file: AvatarUpload | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<AccountRead> {
    if (file === undefined) {
      throw new AvatarInvalidError('Файл аватарки обязателен (поле "file").');
    }
    return this._uploadAvatarUseCase.execute(request.account.id, request.account.avatar, file);
  }

  /**
   * Удаляет аватарку.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённый профиль без секрета.
   */
  @Delete('me/avatar')
  @UseGuards(AuthGuard)
  public async deleteAvatar(@Req() request: AuthenticatedRequest): Promise<AccountRead> {
    return this._removeAvatarUseCase.execute(request.account.id, request.account.avatar);
  }

  /**
   * Публичный профиль участника по логину.
   * @param login Логин.
   * @returns Публичная проекция.
   */
  @Get(':login')
  @UseGuards(AuthGuard)
  public async getByLogin(@Param('login') login: string): Promise<AccountPublicView> {
    return this._getProfileByLoginUseCase.execute(login);
  }
}
