import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '../config/env.schema';
import type { DrizzleDatabase } from './database.constants';

/**
 * Сервис подключения к PostgreSQL: владеет пулом соединений и инстансом Drizzle.
 * Пингует БД при старте (fail-fast) и аккуратно закрывает пул при остановке.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  /** Инстанс Drizzle — точка доступа к БД для репозиториев. */
  public readonly db: DrizzleDatabase;

  /** Пул соединений node-postgres. */
  private readonly _pool: Pool;

  /**
   * @param configService Сервис конфигурации (параметры подключения к БД).
   */
  public constructor(configService: ConfigService<Env, true>) {
    this._pool = new Pool({
      host: configService.get('DB_HOST', { infer: true }),
      port: configService.get('DB_PORT', { infer: true }),
      user: configService.get('DB_USER', { infer: true }),
      password: configService.get('DB_PASSWORD', { infer: true }),
      database: configService.get('DB_NAME', { infer: true }),
    });
    this.db = drizzle(this._pool);
  }

  /**
   * Проверяет соединение с БД при инициализации модуля (fail-fast).
   * @returns Промис, завершающийся после успешного пинга.
   */
  public async onModuleInit(): Promise<void> {
    await this._pool.query('SELECT 1');
  }

  /**
   * Закрывает пул соединений при остановке приложения.
   * @returns Промис, завершающийся после закрытия пула.
   */
  public async onModuleDestroy(): Promise<void> {
    await this._pool.end();
  }
}
