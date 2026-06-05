import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { updateAliasSchema } from '../dtos/update-alias.dto';
import type { UpdateAliasDto } from '../dtos/update-alias.dto';
import { GetProfileByLoginUseCase } from '../use-cases/get-profile-by-login.use-case';
import { UpdateAliasUseCase } from '../use-cases/update-alias.use-case';
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
   */
  public constructor(
    private readonly _getProfileByLoginUseCase: GetProfileByLoginUseCase,
    private readonly _updateAliasUseCase: UpdateAliasUseCase,
  ) {}

  /**
   * Свой профиль (из аккаунта, загруженного Guard'ом).
   * @param request Запрос (аккаунт из Guard).
   * @returns Свой профиль без секрета.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  public getMe(@Req() request: AuthenticatedRequest): AccountRead {
    const { passwordHash: _passwordHash, ...read } = request.account;
    return read;
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
