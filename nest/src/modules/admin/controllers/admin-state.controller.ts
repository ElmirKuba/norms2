import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { GetReleaseStateUseCase } from '../use-cases/get-release-state.use-case';
import type { ReleaseStateView } from '../interfaces/release-state-view.interface';

/**
 * Состояние выпуска (`/api/v1/admin/release-state`, 2.9.3·12).
 *
 * Отдельно от публичного `GET /version` намеренно: тот отвечает футеру «какая версия», а этот —
 * админу «всё ли доехало». Счётчики и состояние миграций публичными быть не должны.
 */
@Controller('admin/release-state')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminStateController {
  /**
   * @param _getReleaseStateUseCase Сборка состояния.
   */
  public constructor(private readonly _getReleaseStateUseCase: GetReleaseStateUseCase) {}

  /**
   * Что развёрнуто и всё ли доехало.
   * @returns Состояние выпуска.
   */
  @Get()
  public async get(): Promise<ReleaseStateView> {
    return this._getReleaseStateUseCase.execute();
  }
}
