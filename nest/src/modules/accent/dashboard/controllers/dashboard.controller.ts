import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { GetDashboardUseCase } from '../use-cases/get-dashboard.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { DashboardView } from '../interfaces/dashboard-view.interface';

/** Главный экран «Акцента» — один агрегирующий запрос (2.11). */
@Controller('accent')
@UseGuards(AuthGuard)
export class DashboardController {
  /**
   * @param _dashboard Use-case снимка главного экрана.
   */
  public constructor(private readonly _dashboard: GetDashboardUseCase) {}

  /**
   * Снимок главного экрана: «Сейчас», день, цели, «держусь», просрочка, шаги онбординга.
   * @param request Запрос (аккаунт из Guard).
   * @returns Снимок дашборда.
   */
  @Get('dashboard')
  public get(@Req() request: AuthenticatedRequest): Promise<DashboardView> {
    return this._dashboard.execute(request.account.id, request.account.timezone);
  }
}
