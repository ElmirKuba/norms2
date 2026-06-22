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
 * `/api/v1`, глобальный фильтр ошибок, CORS (config-driven) и trust proxy (за
 * Traefik в проде); порт берёт из конфига (ConfigService, не process.env) и
 * слушает на всех интерфейсах (Docker).
 * @returns Промис, завершающийся после старта HTTP-сервера.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // pino как логгер приложения (буферизованные стартовые логи тоже уйдут в pino).
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService<Env, true>>(ConfigService);

  // За reverse-proxy (Traefik) доверяем первому хопу: корректные req.secure
  // (Secure-cookie по X-Forwarded-Proto) и req.ip (X-Forwarded-For → rate-limit).
  // Прод — same-origin за Traefik; dev — прямое подключение, прокси нет.
  if (configService.get('NODE_ENV', { infer: true }) === 'production') {
    app.set('trust proxy', 1);
  }

  // Все REST-эндпоинты под /api/v1 (ADR-0020).
  app.setGlobalPrefix('api/v1');

  // Единый конверт ошибок { error: { code, message, details? } }.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Парсинг cookie (refresh-токен в httpOnly-cookie).
  app.use(cookieParser());

  // Базовые security-заголовки (без зависимостей). nosniff критичен для /content/*
  // (пользовательские загрузки — не давать браузеру угадывать MIME → защита от XSS
  // через загруженный файл); API не должен встраиваться во фрейм; не утекать referrer.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // CORS — config-driven (ADR-0020/D1): включаем ТОЛЬКО если задан CORS_ORIGIN
  // (dev: фронт на другом порту). В проде same-origin (Traefik path-based) →
  // CORS_ORIGIN пуст → CORS выключен, лишних заголовков нет.
  // ВАЖНО: до useStaticAssets — иначе express.static отдаёт файл и завершает ответ
  // РАНЬШЕ cors-middleware, и на GET /content/* нет Access-Control-Allow-Origin →
  // браузерный fetch (центр уведомлений, рич-контент .md) блокируется (только dev).
  const corsOrigin = configService.get('CORS_ORIGIN', { infer: true });
  if (corsOrigin !== '') {
    app.enableCors({ origin: corsOrigin, credentials: true });
  }

  // Статика загруженных файлов (аватарки и пр.) из CONTENT_DIR под /content/
  // (ADR-0031: хранилище — локальный диск). DB хранит путь относительно content/.
  const contentDir = resolve(configService.get('CONTENT_DIR', { infer: true }));
  app.useStaticAssets(contentDir, { prefix: '/content/' });

  const port = configService.get('BACKEND_PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
