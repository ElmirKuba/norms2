import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TooManyRequestsError } from '../errors/too-many-requests.error';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import type { RateLimitOptions } from './rate-limit.decorator';

/** Счётчик окна для пары (IP, роут). */
interface Bucket {
  /** Число запросов в текущем окне. */
  count: number;
  /** Когда окно сбросится (epoch ms). */
  resetAt: number;
}

/** Порог размера хранилища, при котором запускаем уборку протухших окон. */
const PRUNE_THRESHOLD = 5000;

/**
 * Глобальный guard ограничения частоты (anti-brute-force, F5.5). Действует только
 * на роуты с `@RateLimit(...)` — иначе пропускает. Фиксированное окно по
 * (IP, контроллер.метод), in-memory (single-instance self-host, без зависимостей).
 * За реальным IP в проде стоит `trust proxy` (Traefik, D1.1).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly _buckets = new Map<string, Bucket>();

  /**
   * @param _reflector Доступ к метаданным `@RateLimit`.
   */
  public constructor(private readonly _reflector: Reflector) {}

  /**
   * Пропускает запрос, если лимит не задан или не превышен; иначе 429.
   * @param context Контекст выполнения.
   * @returns true, если можно.
   * @throws {TooManyRequestsError} При превышении лимита.
   */
  public canActivate(context: ExecutionContext): boolean {
    const options = this._reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (options === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const key = `${ip}:${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();
    this._prune(now);

    const bucket = this._buckets.get(key);
    if (bucket === undefined || now >= bucket.resetAt) {
      this._buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }
    if (bucket.count >= options.limit) {
      throw new TooManyRequestsError('Слишком много попыток. Попробуйте позже.');
    }
    bucket.count += 1;
    return true;
  }

  /** Удаляет протухшие окна, если хранилище разрослось (защита от утечки памяти). */
  private _prune(now: number): void {
    if (this._buckets.size < PRUNE_THRESHOLD) {
      return;
    }
    for (const [key, bucket] of this._buckets) {
      if (now >= bucket.resetAt) {
        this._buckets.delete(key);
      }
    }
  }
}
