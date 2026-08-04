import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { GetStatsUseCase } from '../use-cases/get-stats.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { StatsView } from '../interfaces/stats-view.interface';

/** Экран статистики «Акцента» — постоянство и достижения (2.9). */
@Controller('accent')
@UseGuards(AuthGuard)
export class StatsController {
  /**
   * @param _stats Use-case снимка статистики.
   */
  public constructor(private readonly _stats: GetStatsUseCase) {}

  /**
   * Снимок статистики: постоянство по аккаунту и привычкам, каталог достижений.
   * @param request Запрос (аккаунт из Guard).
   * @returns Снимок статистики.
   */
  @Get('stats')
  public get(@Req() request: AuthenticatedRequest): Promise<StatsView> {
    return this._stats.execute(request.account.id, request.account.timezone);
  }
}
