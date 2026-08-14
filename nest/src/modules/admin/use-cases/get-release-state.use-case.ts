import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ADMIN_STATE_REPOSITORY } from '../adapters/admin-state-repository.port';
import { readMigrationTags } from '../../../shared/utility-level/read-migration-journal.util';
import { readProductVersion } from '../../../shared/utility-level/read-product-version.util';
import { readGitCommit } from '../../../shared/utility-level/read-git-commit.util';
import type { AdminStateRepositoryPort } from '../adapters/admin-state-repository.port';
import type { ReleaseStateView } from '../interfaces/release-state-view.interface';
import type { Env } from '../../../system/config/env.schema';
import {
  SETTING_TELEGRAM_BOT_PAUSED,
  SettingsDomainService,
} from '../../settings/domain-services/settings.domain-service';

/**
 * Состояние выпуска (2.9.3·12) — «что развёрнуто и всё ли доехало».
 *
 * Собирает ответ из трёх непохожих источников: файл `VERSION` и git-SHA (что за билд), журнал
 * drizzle-kit против служебной таблицы (на какой схеме поднялись), база (счётчики и судьба
 * последней публикации).
 *
 * **Главный вопрос экрана — «последний релиз объявлен?».** Ошибки доставки в канал глушатся
 * осознанно (ADR-0064), поэтому «посты перестали уходить» сегодня видно только по логам. Здесь
 * это одно поле, которое видно сразу.
 */
@Injectable()
export class GetReleaseStateUseCase {
  private readonly _envCommit: string;
  private readonly _telegramToken: string;
  private readonly _webhookSecret: string;
  private readonly _botUsername: string;
  private readonly _publicBaseUrl: string;

  /**
   * @param _repository Порт диагностических чтений.
   * @param configService Конфиг (`GIT_COMMIT` фиксируется на сборке прод-образа).
   */
  public constructor(
    @Inject(ADMIN_STATE_REPOSITORY) private readonly _repository: AdminStateRepositoryPort,
    configService: ConfigService<Env, true>,
    private readonly _settings: SettingsDomainService,
  ) {
    this._envCommit = configService.get('GIT_COMMIT', { infer: true });
    this._telegramToken = configService.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this._webhookSecret = configService.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
    this._botUsername = configService.get('TELEGRAM_BOT_USERNAME', { infer: true });
    this._publicBaseUrl = configService.get('PUBLIC_BASE_URL', { infer: true });
  }

  /**
   * Собирает состояние выпуска.
   * @returns Проекция для экрана.
   */
  public async execute(): Promise<ReleaseStateView> {
    const [counters, applied, lastRelease] = await Promise.all([
      this._repository.counters(),
      this._repository.appliedMigrations(),
      this._repository.lastRelease(),
    ]);
    const tags = readMigrationTags();

    return {
      product: readProductVersion(),
      commit: this._envCommit !== '' ? this._envCommit : readGitCommit(),
      migrations: {
        applied,
        expected: tags.length,
        // Тег берётся по числу применённых, а не «последний из журнала»: если база отстала,
        // показать надо ту миграцию, на которой она реально стоит, а не ту, что лежит в образе.
        // Ограничение сверху — на случай, когда база НОВЕЕ образа: тогда имени последней
        // применённой мы попросту не знаем, и честнее показать последнюю известную, чем прочерк.
        last: this._tagAt(tags, applied),
        behind: applied < tags.length,
      },
      counters,
      lastRelease,
      telegram: {
        configured: this._telegramToken !== '',
        paused: this._settings.getBoolean(SETTING_TELEGRAM_BOT_PAUSED),
        webhookSecret: this._webhookSecret !== '',
        botUsername: this._botUsername,
        publicBaseUrl: this._publicBaseUrl,
      },
    };
  }

  /**
   * Тег миграции, на которой стоит база.
   * @param tags Теги из журнала образа.
   * @param applied Сколько миграций применено.
   * @returns Тег или null, если применено ноль либо журнал не прочитался.
   */
  private _tagAt(tags: string[], applied: number): string | null {
    if (applied <= 0 || tags.length === 0) {
      return null;
    }
    return tags[Math.min(applied, tags.length) - 1] ?? null;
  }
}
