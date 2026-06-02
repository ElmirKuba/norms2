import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.schema';

/**
 * Глобальный модуль логирования на pino (nestjs-pino): структурный JSON,
 * request-id на запрос, redact секретов. В dev — human-friendly pino-pretty;
 * health-эндпоинты не логируем (чтобы не шуметь от пингов).
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>): Params => {
        const isProduction = configService.get('NODE_ENV', { infer: true }) === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              '*.password',
              '*.token',
              '*.answer',
            ],
            autoLogging: {
              ignore: (request: IncomingMessage): boolean =>
                request.url?.startsWith('/api/v1/health') ?? false,
            },
            // transport добавляем только в dev (pino-pretty); в проде — чистый JSON.
            // (exactOptionalPropertyTypes не разрешает transport: undefined.)
            ...(isProduction
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: { singleLine: true, translateTime: 'SYS:standard' },
                  },
                }),
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
