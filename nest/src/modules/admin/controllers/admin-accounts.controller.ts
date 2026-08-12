import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { ManageRolesUseCase } from '../use-cases/manage-roles.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { AdminAccountPage } from '../interfaces/admin-account-page.interface';
import type { AdminAccountView } from '../interfaces/admin-account-view.interface';

/** Тело запроса на выдачу роли. */
interface GrantRoleBody {
  /** Код роли (`admin`). */
  code: string;
}

/**
 * Люди и их роли (`/api/v1/admin/accounts`, 2.9.3·10).
 *
 * Guard-ы в порядке `AuthGuard` → `RolesGuard`: второй берёт роли у аккаунта, которого в запрос
 * кладёт первый. Перестановка молча превратила бы проверку прав в отказ всем подряд.
 *
 * ⚠️ **Наружу уходит только то, что и так видно в продукте** — логин, псевдоним, роли, источник
 * регистрации, квота и метки жизненного цикла. Ни хешей, ни ответов на секретные вопросы, ни
 * содержимого чужих разделов: «я же админ» основанием не является.
 */
@Controller('admin/accounts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminAccountsController {
  /**
   * @param _manageRolesUseCase Список людей и управление ролями.
   */
  public constructor(private readonly _manageRolesUseCase: ManageRolesUseCase) {}

  /**
   * Страница людей с ролями.
   * @param query Подстрока логина или псевдонима.
   * @param limit Размер страницы.
   * @param cursor Курсор предыдущей страницы.
   * @returns Строки и курсор следующей страницы.
   */
  @Get()
  public async list(
    @Query('query') query?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<AdminAccountPage> {
    return this._manageRolesUseCase.list(query ?? '', Number(limit), cursor ?? null);
  }

  /**
   * Выдаёт роль. Идемпотентно: повтор ничего не меняет и ошибкой не считается.
   * @param id Кому.
   * @param body Код роли.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая строка человека.
   */
  @Post(':id/roles')
  public async grant(
    @Param('id') id: string,
    @Body() body: GrantRoleBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminAccountView> {
    return this._manageRolesUseCase.grant(id, body.code, {
      accountId: request.account.id,
      login: request.account.login,
    });
  }

  /**
   * Снимает роль. Идемпотентно; снять `admin` с себя нельзя (409).
   * @param id У кого.
   * @param code Код роли.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая строка человека.
   */
  @Delete(':id/roles/:code')
  public async revoke(
    @Param('id') id: string,
    @Param('code') code: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminAccountView> {
    return this._manageRolesUseCase.revoke(id, code, {
      accountId: request.account.id,
      login: request.account.login,
    });
  }
}
