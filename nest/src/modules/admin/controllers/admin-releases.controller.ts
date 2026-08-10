import { Controller, Delete, HttpCode, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { DeleteReleaseUseCase } from '../use-cases/delete-release.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

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
   */
  public constructor(private readonly _deleteReleaseUseCase: DeleteReleaseUseCase) {}

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
