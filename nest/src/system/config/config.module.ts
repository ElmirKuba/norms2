import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnv } from './env.schema';
import { TelegramReadinessReporter } from './telegram-readiness.reporter';

/**
 * Глобальный модуль конфигурации: грузит корневой .env (на хосте) и валидирует
 * все переменные окружения через zod (fail-fast). В Docker переменные приходят
 * из окружения контейнера — файла может не быть, это нормально.
 *
 * Здесь же живёт **сводка готовности** (2.9.3·28): валидация ловит неверный тип, но не ловит
 * «настроено наполовину» — пустая строка формально валидна. Именно она дважды за 14.08.2026
 * оставляла бота молчащим, а ссылки — ведущими на localhost.
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
  providers: [TelegramReadinessReporter],
})
export class AppConfigModule {}
