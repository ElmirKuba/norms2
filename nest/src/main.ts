import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Env } from './system/config/env.schema';

/**
 * Точка входа: создаёт Nest-приложение, ставит pino-логгер, общий префикс API
 * `/api/v1`, глобальный фильтр ошибок и CORS для dev-фронта; порт берёт из
 * конфига (ConfigService, не process.env) и слушает на всех интерфейсах (Docker).
 * @returns Промис, завершающийся после старта HTTP-сервера.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // pino как логгер приложения (буферизованные стартовые логи тоже уйдут в pino).
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService<Env, true>>(ConfigService);

  // Все REST-эндпоинты под /api/v1 (ADR-0020).
  app.setGlobalPrefix('api/v1');

  // Единый конверт ошибок { error: { code, message, details? } }.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Парсинг cookie (refresh-токен в httpOnly-cookie).
  app.use(cookieParser());

  // Статика загруженных файлов (аватарки и пр.) из CONTENT_DIR под /content/
  // (ADR-0031: хранилище — локальный диск). DB хранит путь относительно content/.
  const contentDir = resolve(configService.get('CONTENT_DIR', { infer: true }));
  app.useStaticAssets(contentDir, { prefix: '/content/' });

  // CORS: фронт ходит с другого порта; credentials — под будущую refresh-cookie.
  const frontendPort = configService.get('FRONTEND_PORT', { infer: true });
  app.enableCors({
    origin: `http://localhost:${String(frontendPort)}`,
    credentials: true,
  });

  const port = configService.get('BACKEND_PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
