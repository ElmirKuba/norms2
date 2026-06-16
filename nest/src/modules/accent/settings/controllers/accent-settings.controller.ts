import { Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { GetSettingsUseCase } from '../use-cases/get-settings.use-case';
import { PauseAccentUseCase } from '../use-cases/pause-accent.use-case';
import { ResumeAccentUseCase } from '../use-cases/resume-accent.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { AccentSettingsView } from '../interfaces/accent-settings-view.interface';

/**
 * Контроллер настроек раздела «Акцент» (`/api/v1/accent/*`) — под Guard
 * (members-only). Настройки/пауза. `PATCH /accent/settings` появится с полем
 * `overallStreakThreshold` (2.8). Тонкий слой: контроллер → use-case.
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class AccentSettingsController {
  /**
   * @param _getSettings Чтение настроек.
   * @param _pause Включить паузу.
   * @param _resume Снять паузу.
   */
  public constructor(
    private readonly _getSettings: GetSettingsUseCase,
    private readonly _pause: PauseAccentUseCase,
    private readonly _resume: ResumeAccentUseCase,
  ) {}

  /**
   * Настройки раздела (ленивое создание при первом обращении).
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция настроек.
   */
  @Get('settings')
  public getSettings(@Req() request: AuthenticatedRequest): Promise<AccentSettingsView> {
    return this._getSettings.execute(request.account.id);
  }

  /**
   * Включить пауза-режим (заморозка серий/ролловера).
   * @param request Запрос (аккаунт из Guard).
   * @returns 204.
   */
  @Post('pause')
  @HttpCode(204)
  public pause(@Req() request: AuthenticatedRequest): Promise<void> {
    return this._pause.execute(request.account.id);
  }

  /**
   * Снять пауза-режим.
   * @param request Запрос (аккаунт из Guard).
   * @returns 204.
   */
  @Post('resume')
  @HttpCode(204)
  public resume(@Req() request: AuthenticatedRequest): Promise<void> {
    return this._resume.execute(request.account.id);
  }
}
