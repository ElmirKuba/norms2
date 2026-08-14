import { Body, Controller, Delete, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { LiftBanUseCase } from '../use-cases/lift-ban.use-case';
import { BanFromAdminUseCase } from '../use-cases/ban-from-admin.use-case';
import { LiftBansOfAccountUseCase } from '../use-cases/lift-bans-of-account.use-case';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { banFromAdminSchema } from '../dtos/ban-from-admin.dto';
import type { BanFromAdminDto } from '../dtos/ban-from-admin.dto';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

/**
 * Снятие банов админом (`/api/v1/admin/bans`, 2.9.3·21).
 *
 * **Ручки админа отдельные от пользовательских, и это не дублирование** (реш. Elmir 14.08.2026).
 * У обычного бана право идёт по ветке приглашений
 * ([ADR-0003](../../../../docs/decisions/0003-ban-semantics.md)) — только своё поддерево; у
 * админа границ ветки нет. Разные правила должны читаться по адресу, а не прятаться в условии
 * внутри метода. Человеку без роли этот префикс недоступен физически: весь `/admin/*` отдаёт 404.
 *
 * **Причина обязательна и здесь.** Забаненный прочитает её при входе и получит от бота, если
 * привязал Telegram: «доступ закрыт без объяснения» — худшее, что продукт может сказать.
 */
@Controller('admin/bans')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminBansController {
  /**
   * @param _liftBanUseCase Снятие бана.
   */
  public constructor(
    private readonly _liftBanUseCase: LiftBanUseCase,
    private readonly _banFromAdminUseCase: BanFromAdminUseCase,
    private readonly _liftBansOfAccountUseCase: LiftBansOfAccountUseCase,
  ) {}

  /**
   * Банит человека от имени админа — вне ветки приглашений. Идемпотентно: повтор обновляет
   * причину, второй записи не появляется.
   * @param body Кого и за что.
   * @param request Запрос (аккаунт из Guard).
   * @returns Ничего (204).
   */
  @Post()
  @HttpCode(204)
  public async ban(
    @Body(new ZodValidationPipe(banFromAdminSchema)) body: BanFromAdminDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._banFromAdminUseCase.execute(body.targetId, body.reason, {
      accountId: request.account.id,
      login: request.account.login,
    });
  }

  /**
   * Снимает с человека **все** активные баны — экран «Люди и роли» смотрит на человека, а не на
   * список чужих решений о нём.
   * @param accountId Кого разбанить.
   * @param request Запрос (аккаунт из Guard).
   * @returns Ничего (204).
   */
  @Delete('of/:accountId')
  @HttpCode(204)
  public async liftAll(
    @Param('accountId') accountId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._liftBansOfAccountUseCase.execute(accountId, {
      accountId: request.account.id,
      login: request.account.login,
    });
  }

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
