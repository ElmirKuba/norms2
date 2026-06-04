import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { registerSchema } from '../dtos/register.dto';
import type { RegisterDto } from '../dtos/register.dto';
import { loginSchema } from '../dtos/login.dto';
import type { LoginDto } from '../dtos/login.dto';
import { RegisterAccountUseCase } from '../use-cases/register-account.use-case';
import { GetRegistrationModeUseCase } from '../use-cases/get-registration-mode.use-case';
import { LoginAccountUseCase } from '../use-cases/login-account.use-case';
import { RefreshTokensUseCase } from '../use-cases/refresh-tokens.use-case';
import { LogoutUseCase } from '../use-cases/logout.use-case';
import { parseDurationMs } from '../../../shared/utility-level/duration.util';
import type { RegisterResponse } from '../interfaces/register-response.interface';
import type { RegistrationMode } from '../interfaces/registration-mode.interface';
import type { Env } from '../../../system/config/env.schema';

/** Имя cookie с refresh-токеном. */
const REFRESH_COOKIE = 'refresh_token';
/** Путь cookie — только auth-роуты (login/refresh/logout). */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * Контроллер аутентификации (`/api/v1/auth/*`). Тонкий слой: делегирует в
 * use-cases. refresh-токен — в httpOnly-cookie (JS не видит); access — в теле.
 */
@Controller('auth')
export class AuthController {
  /**
   * @param _registerAccountUseCase Регистрация.
   * @param _getRegistrationModeUseCase Режим регистрации.
   * @param _loginAccountUseCase Вход.
   * @param _refreshTokensUseCase Обновление токенов.
   * @param _logoutUseCase Выход.
   * @param _configService Конфиг (COOKIE_SECURE/REFRESH_TTL).
   */
  public constructor(
    private readonly _registerAccountUseCase: RegisterAccountUseCase,
    private readonly _getRegistrationModeUseCase: GetRegistrationModeUseCase,
    private readonly _loginAccountUseCase: LoginAccountUseCase,
    private readonly _refreshTokensUseCase: RefreshTokensUseCase,
    private readonly _logoutUseCase: LogoutUseCase,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Регистрация (токенов не выдаёт, ADR-0010).
   * @param body Провалидированное тело регистрации.
   * @returns Минимум о созданном аккаунте.
   */
  @Post('register')
  public async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
  ): Promise<RegisterResponse> {
    const account = await this._registerAccountUseCase.execute(body);
    return { id: account.id, login: account.login, alias: account.alias };
  }

  /**
   * Текущий режим регистрации.
   * @returns Режим регистрации.
   */
  @Get('registration-mode')
  public registrationMode(): RegistrationMode {
    return this._getRegistrationModeUseCase.execute();
  }

  /**
   * Вход: выдаёт access (в тело) и ставит refresh в httpOnly-cookie.
   * @param body Провалидированное тело входа.
   * @param request Запрос (нужен User-Agent).
   * @param response Ответ (ставит cookie).
   * @returns Access-токен.
   */
  @Post('login')
  @HttpCode(200)
  public async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const tokens = await this._loginAccountUseCase.execute({
      login: body.login,
      password: body.password,
      userAgent: request.headers['user-agent'] ?? null,
    });
    this._setRefreshCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  /**
   * Обновление токенов по refresh-cookie (ротация). Ставит новый refresh-cookie.
   * @param request Запрос (refresh-cookie).
   * @param response Ответ (новый cookie).
   * @returns Новый access-токен.
   */
  @Post('refresh')
  @HttpCode(200)
  public async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const tokens = await this._refreshTokensUseCase.execute(request.cookies[REFRESH_COOKIE]);
    this._setRefreshCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  /**
   * Выход: отзывает сессию и очищает refresh-cookie. Идемпотентно.
   * @param request Запрос (refresh-cookie).
   * @param response Ответ (очистка cookie).
   * @returns Промис завершения.
   */
  @Post('logout')
  @HttpCode(204)
  public async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this._logoutUseCase.execute(request.cookies[REFRESH_COOKIE]);
    response.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax', path: REFRESH_COOKIE_PATH });
  }

  /**
   * Ставит refresh в httpOnly+SameSite cookie (Secure — из конфига).
   * @param response Express-ответ.
   * @param token Плейнтекст refresh-токена.
   */
  private _setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this._configService.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: parseDurationMs(this._configService.get('REFRESH_TTL', { infer: true })),
    });
  }
}
