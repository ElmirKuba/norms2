import { Module } from '@nestjs/common';
import { VersionController } from './version.controller';

/**
 * Модуль версии (ADR-0044): один публичный контроллер `GET /version`. Конфиг
 * глобальный (AppConfigModule), доменных зависимостей нет — лист графа.
 */
@Module({
  controllers: [VersionController],
})
export class VersionModule {}
