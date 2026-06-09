import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GetOverviewStatsUseCase } from '../use-cases/get-overview-stats.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { OverviewStats } from '../interfaces/overview-stats.interface';

/**
 * Контроллер статистики (`/api/v1/stats/*`) — под Guard. Отдаёт агрегаты для
 * главного экрана одним запросом (F4).
 */
@Controller('stats')
export class StatsController {
  /**
   * @param _getOverviewStatsUseCase Сбор overview-статистики.
   */
  public constructor(private readonly _getOverviewStatsUseCase: GetOverviewStatsUseCase) {}

  /**
   * Числа для главного экрана.
   * @param request Запрос (аккаунт из Guard).
   * @returns Агрегаты overview.
   */
  @Get('overview')
  @UseGuards(AuthGuard)
  public async overview(@Req() request: AuthenticatedRequest): Promise<OverviewStats> {
    return this._getOverviewStatsUseCase.execute(request.account);
  }
}
