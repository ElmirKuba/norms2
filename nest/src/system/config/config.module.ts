import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnv } from './env.schema';

/**
 * Глобальный модуль конфигурации: грузит корневой .env (на хосте) и валидирует
 * все переменные окружения через zod (fail-fast). В Docker переменные приходят
 * из окружения контейнера — файла может не быть, это нормально.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // .env лежит в корне репозитория (на уровень выше nest/).
      envFilePath: [resolve(process.cwd(), '..', '.env')],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
