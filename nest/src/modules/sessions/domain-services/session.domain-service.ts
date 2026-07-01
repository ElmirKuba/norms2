import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESSION_REPOSITORY } from '../adapters/session-repository.port';
import type { SessionRepositoryPort } from '../adapters/session-repository.port';
import { InvalidRefreshError } from '../../../shared/errors/invalid-refresh.error';
import { SessionNotFoundError } from '../../../shared/errors/session-not-found.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import { generateOpaqueToken, sha256Hex } from '../../../shared/utility-level/token.util';
import type { SessionFull } from '../interfaces/session-full.interface';
import { parseDurationMs } from '../../../shared/utility-level/duration.util';
import type { Env } from '../../../system/config/env.schema';

/**
 * Domain-service области sessions: жизненный цикл refresh-токенов. Хранит
 * SHA-256 токена (детерминированно — для поиска), сам токен наружу отдаёт один
 * раз (в cookie). Ротация — CAS по token_hash с детектом reuse (ADR-0035).
 */
@Injectable()
export class SessionDomainService {
  /**
   * Грейс-окно (мс): повторное предъявление только что ротированного токена в этом
   * окне = benign-гонка двойного refresh (мягкий отказ, не кара). Вне окна архивный
   * токен = реальный реплей → отзыв ТОЛЬКО той сессии. (2.5.2, ADR-0046)
   */
  private static readonly REUSE_GRACE_MS = 15_000;

  /**
   * @param _sessionRepository Порт репозитория сессий.
   * @param _configService Конфиг (REFRESH_TTL).
   */
  public constructor(
    @Inject(SESSION_REPOSITORY) private readonly _sessionRepository: SessionRepositoryPort,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Создаёт сессию; возвращает плейнтекст refresh-токена (для cookie) и id сессии
   * (для claim `sid` в access-токене, ADR-0041).
   * @param accountId Идентификатор аккаунта.
   * @param userAgent User-Agent устройства или null.
   * @returns `{ refreshToken, sessionId }`.
   */
  public async createSession(
    accountId: string,
    userAgent: string | null,
  ): Promise<{ /**
                *
                */
  refreshToken: string; /**
                         *
                         */
  sessionId: string }> {
    const refreshToken = generateOpaqueToken();
    const sessionId = generateId();
    await this._sessionRepository.create(sessionId, {
      accountId,
      tokenHash: sha256Hex(refreshToken),
      userAgent,
      expiresAt: this._refreshExpiry(),
    });
    return { refreshToken, sessionId };
  }

  /**
   * Ротация: проверяет refresh-токен, выдаёт новый, отзывает старый (CAS).
   * Reuse-detect с грейс-окном (2.5.2, ADR-0046): benign-гонка двойного refresh
   * (CAS-loss / архивный токен в пределах грейса) → мягкий отказ БЕЗ отзыва;
   * реальный реплей ротированного токена (вне грейса) → отзыв ТОЛЬКО той сессии,
   * не всего аккаунта (раньше revoke-all нукал все устройства — кросс-девайс кик).
   * @param refreshToken Плейнтекст предъявленного refresh-токена.
   * @returns Новый refresh-токен + id аккаунта и сессии (для access-токена). Id
   *   сессии стабилен через ротацию (та же строка) → claim `sid` не меняется.
   * @throws {InvalidRefreshError} Если токен недействителен/истёк/reuse.
   */
  public async rotateSession(
    refreshToken: string,
  ): Promise<{ /**
                *
                */
  refreshToken: string; /**
                         *
                         */
  accountId: string; /**
                      *
                      */
  sessionId: string }> {
    const tokenHash = sha256Hex(refreshToken);
    const session = await this._sessionRepository.findByTokenHash(tokenHash);

    if (session === null) {
      // Нет среди активных. Возможно — уже ротированный (архивный) токен.
      const owner = await this._sessionRepository.findHistoricalTokenOwner(tokenHash);
      if (
        owner !== null &&
        Date.now() - owner.archivedAt.getTime() > SessionDomainService.REUSE_GRACE_MS
      ) {
        // Архивный токен предъявлен ПОЗЖЕ грейса → реальный реплей ротированного
        // токена (вероятная кража) → отзыв ТОЛЬКО этой сессии (не всего аккаунта).
        await this._sessionRepository.revokeById(owner.sessionId);
      }
      // В пределах грейса (benign-гонка двойного refresh) или неизвестный токен —
      // мягкий отказ без отзыва: победивший параллельный refresh уже выдал новый токен.
      throw new InvalidRefreshError('Недействительный refresh-токен.');
    }
    if (session.revokedAt !== null) {
      // Токен отозванной сессии: она уже мертва, другие устройства не трогаем.
      throw new InvalidRefreshError('Недействительный refresh-токен.');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshError('Refresh-токен истёк.');
    }

    const newRefreshToken = generateOpaqueToken();
    const rotated = await this._sessionRepository.rotate(
      session.id,
      tokenHash,
      sha256Hex(newRefreshToken),
      this._refreshExpiry(),
      generateId(),
    );
    if (rotated === null) {
      // CAS не прошёл = параллельная ротация ЭТОЙ ЖЕ активной сессии (benign двойной
      // refresh) → мягкий отказ без отзыва; победивший запрос уже выдал новый токен.
      throw new InvalidRefreshError('Недействительный refresh-токен.');
    }
    return { refreshToken: newRefreshToken, accountId: rotated.accountId, sessionId: rotated.id };
  }

  /**
   * Активные сессии аккаунта (список устройств).
   * @param accountId Идентификатор аккаунта.
   * @returns Активные сессии.
   */
  public async listActive(accountId: string): Promise<SessionFull[]> {
    return this._sessionRepository.listActiveByAccount(accountId);
  }

  /**
   * Жива ли сессия по id (для проверки в Guard — немедленный отзыв доступа на
   * отозванном устройстве, ADR-0043).
   * @param sessionId Идентификатор сессии (sid из access-токена).
   * @returns true, если активна.
   */
  public async isActive(sessionId: string): Promise<boolean> {
    return this._sessionRepository.existsActiveById(sessionId);
  }

  /**
   * Отзывает СВОЮ сессию по id (отзыв конкретного устройства).
   * @param sessionId Идентификатор сессии.
   * @param accountId Владелец.
   * @throws {SessionNotFoundError} Если сессия не найдена/не своя/уже отозвана.
   */
  public async revokeOwn(sessionId: string, accountId: string): Promise<void> {
    const revoked = await this._sessionRepository.revokeByIdForAccount(sessionId, accountId);
    if (!revoked) {
      throw new SessionNotFoundError('Сессия не найдена.');
    }
  }

  /**
   * Отзывает все сессии аккаунта, КРОМЕ текущей (revoke-others).
   * @param accountId Владелец.
   * @param keepSessionId Текущая сессия (не отзывать).
   * @returns Промис завершения.
   */
  public async revokeOthers(accountId: string, keepSessionId: string): Promise<void> {
    await this._sessionRepository.revokeAllByAccountExcept(accountId, keepSessionId);
  }

  /**
   * Отзывает ВСЕ сессии аккаунта (кросс-домен: после deactivate/delete/сброса
   * пароля — везде выйти).
   * @param accountId Владелец.
   * @returns Промис завершения.
   */
  public async revokeAllForAccount(accountId: string): Promise<void> {
    await this._sessionRepository.revokeAllByAccount(accountId);
  }

  /**
   * Отзывает сессию по refresh-токену (logout). Идемпотентно.
   * @param refreshToken Плейнтекст refresh-токена.
   * @returns Промис завершения.
   */
  public async revokeSession(refreshToken: string): Promise<void> {
    const session = await this._sessionRepository.findByTokenHash(sha256Hex(refreshToken));
    if (session !== null) {
      await this._sessionRepository.revokeById(session.id);
    }
  }

  /**
   * Вычисляет срок жизни refresh из REFRESH_TTL.
   * @returns Дата истечения.
   */
  private _refreshExpiry(): Date {
    return new Date(Date.now() + parseDurationMs(this._configService.get('REFRESH_TTL', { infer: true })));
  }
}
