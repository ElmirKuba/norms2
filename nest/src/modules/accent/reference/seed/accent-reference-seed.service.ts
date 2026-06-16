import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ACCENT_REFERENCE_REPOSITORY } from '../adapters/accent-reference-repository.port';
import type { AccentReferenceRepositoryPort } from '../adapters/accent-reference-repository.port';
import { DEFAULT_DOMAINS, DEFAULT_ATTRIBUTES } from './accent-reference.seed';

/**
 * Сид справочников «Акцента»: на старте гарантирует наличие дефолтных сфер и
 * атрибутов (идемпотентно, ON CONFLICT по `key` — повторный старт дублей не плодит,
 * ручные правки не перетирает). Best-effort: сбой сида не валит запуск приложения.
 */
@Injectable()
export class AccentReferenceSeedService implements OnApplicationBootstrap {
  private readonly _logger = new Logger(AccentReferenceSeedService.name);

  /**
   * @param _repository Порт репозитория справочников.
   */
  public constructor(
    @Inject(ACCENT_REFERENCE_REPOSITORY) private readonly _repository: AccentReferenceRepositoryPort,
  ) {}

  /** Сеет дефолтные сферы и атрибуты после инициализации приложения. */
  public async onApplicationBootstrap(): Promise<void> {
    try {
      await this._repository.ensureDomains(DEFAULT_DOMAINS);
      await this._repository.ensureAttributes(DEFAULT_ATTRIBUTES);
    } catch (error) {
      this._logger.warn(`Сид справочников «Акцента» пропущен: ${String(error)}`);
    }
  }
}
