import { Body, Controller, Get, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { registerSchema } from '../dtos/register.dto';
import type { RegisterDto } from '../dtos/register.dto';
import { RegisterAccountUseCase } from '../use-cases/register-account.use-case';
import { GetRegistrationModeUseCase } from '../use-cases/get-registration-mode.use-case';
import type { RegisterResponse } from '../interfaces/register-response.interface';
import type { RegistrationMode } from '../interfaces/registration-mode.interface';

/**
 * Контроллер аутентификации. С глобальным префиксом: `POST /api/v1/auth/register`
 * и `GET /api/v1/auth/registration-mode`. Тонкий слой — делегирует в use-cases.
 */
@Controller('auth')
export class AuthController {
  /**
   * @param _registerAccountUseCase Use-case регистрации.
   * @param _getRegistrationModeUseCase Use-case режима регистрации.
   */
  public constructor(
    private readonly _registerAccountUseCase: RegisterAccountUseCase,
    private readonly _getRegistrationModeUseCase: GetRegistrationModeUseCase,
  ) {}

  /**
   * Регистрация аккаунта (токенов не выдаёт, ADR-0010). Тело валидирует zod-пайп.
   * @param body Провалидированное тело регистрации.
   * @returns Минимум о созданном аккаунте (id/login/alias).
   */
  @Post('register')
  public async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
  ): Promise<RegisterResponse> {
    const account = await this._registerAccountUseCase.execute(body);
    return { id: account.id, login: account.login, alias: account.alias };
  }

  /**
   * Текущий режим регистрации (фронт проверяет по клику «Регистрация»).
   * @returns Режим регистрации.
   */
  @Get('registration-mode')
  public registrationMode(): RegistrationMode {
    return this._getRegistrationModeUseCase.execute();
  }
}
