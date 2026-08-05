import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PublicConfigController } from './controllers/public-config.controller';
import { GetPublicConfigUseCase } from './use-cases/get-public-config.use-case';

/**
 * Публичная конфигурация для неаутентифицированной части приложения (2.9.1).
 *
 * Модуль-агрегатор: своей предметной области у него нет, он лишь собирает публичные строки
 * областей в один ответ. Поэтому импортирует их модули, а не наоборот, — направление
 * зависимостей остаётся вниз, и области про него не знают.
 */
@Module({
  imports: [AuthModule, TelegramModule],
  controllers: [PublicConfigController],
  providers: [GetPublicConfigUseCase],
})
export class PublicConfigModule {}
