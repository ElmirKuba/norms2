import { Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { LiftBanUseCase } from '../use-cases/lift-ban.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

/**
 * Снятие банов админом (`/api/v1/admin/bans`, 2.9.3·21).
 *
 * Единственная операция — снять. Забанить отсюда нельзя намеренно: бан у нас идёт **по ветке
 * приглашений** ([ADR-0003](../../../../docs/decisions/0003-ban-semantics.md)), это отношение
 * между людьми, а не административная мера. Админ здесь только открывает выход, которого иначе
 * может не оказаться ни у кого.
 */
@Controller('admin/bans')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminBansController {
  /**
   * @param _liftBanUseCase Снятие бана.
   */
  public constructor(private readonly _liftBanUseCase: LiftBanUseCase) {}

  /**
   * Снимает активный бан.
   * @param id Идентификатор записи.
   * @param request Запрос (аккаунт из Guard).
   * @returns Ничего (204).
   */
  @Post(':id/lift')
  @HttpCode(204)
  public async lift(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._liftBanUseCase.execute(id, {
      accountId: request.account.id,
      login: request.account.login,
    });
  }
}
