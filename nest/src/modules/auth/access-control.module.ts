import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccountModule } from '../account/account.module';
import { AccessTokenService } from './services/access-token.service';
import { AuthGuard } from './guards/auth.guard';
import type { Env } from '../../system/config/env.schema';

/**
 * Модуль контроля доступа: проверка access-токена (`AccessTokenService`,
 * настроенный `JwtModule`) и защита роутов (`AuthGuard`). Выделен из `AuthModule`,
 * чтобы разорвать цикл: фичи (invites, …) импортируют ЕГО ради guard, а
 * `AuthModule` (флоу рега/вход/refresh) зависит вниз от тех же фич — без круговой
 * DI (ADR-0037). Не знает про auth-флоу; зависит только от `AccountModule`
 * (guard грузит активный аккаунт). Экспортит guard + сервис + реэкспорт `JwtModule`
 * — guard инстанцируется в DI-скоупе модуля-контроллера, его зависимости обязаны
 * резолвиться там же.
 */
@Module({
  imports: [
    AccountModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        secret: configService.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { expiresIn: configService.get('ACCESS_TTL', { infer: true }) },
      }),
    }),
  ],
  providers: [AccessTokenService, AuthGuard],
  exports: [AccessTokenService, AuthGuard, JwtModule],
})
export class AccessControlModule {}
