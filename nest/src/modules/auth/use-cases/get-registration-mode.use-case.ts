import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RegistrationMode } from '../interfaces/registration-mode.interface';
import type { Env } from '../../../system/config/env.schema';

/**
 * Use-case режима регистрации (GET /auth/registration-mode) — проверяется
 * фронтом по клику «Регистрация» (ADR-0032). Читает конфиг.
 */
@Injectable()
export class GetRegistrationModeUseCase {
  /**
   * @param _configService Конфиг.
   */
  public constructor(private readonly _configService: ConfigService<Env, true>) {}

  /**
   * Возвращает текущий режим регистрации.
   * @returns Режим (свободная регистрация или invite-only).
   */
  public execute(): RegistrationMode {
    return { freeRegistration: this._configService.get('FREE_REGISTRATION', { infer: true }) };
  }
}
