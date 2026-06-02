import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './system/config/env.schema';

/**
 * Точка входа: создаёт Nest-приложение, берёт порт из конфига (ConfigService,
 * не process.env) и слушает его на всех интерфейсах (нужно для Docker).
 * @returns Промис, завершающийся после старта HTTP-сервера.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const port = configService.get('BACKEND_PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
