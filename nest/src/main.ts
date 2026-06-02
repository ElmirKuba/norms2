import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './system/config/env.schema';

/**
 * Точка входа: создаёт Nest-приложение, ставит общий префикс API `/api/v1`,
 * включает CORS для dev-фронта, берёт порт из конфига (ConfigService, не
 * process.env) и слушает его на всех интерфейсах (нужно для Docker).
 * @returns Промис, завершающийся после старта HTTP-сервера.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<Env, true>>(ConfigService);

  // Все REST-эндпоинты под /api/v1 (ADR-0020).
  app.setGlobalPrefix('api/v1');

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
