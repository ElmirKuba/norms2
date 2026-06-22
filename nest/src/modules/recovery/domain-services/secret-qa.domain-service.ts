import { Inject, Injectable } from '@nestjs/common';
import { SECRET_QA_REPOSITORY } from '../adapters/secret-qa-repository.port';
import type { SecretQaRepositoryPort } from '../adapters/secret-qa-repository.port';
import { HashService } from '../../../shared/services/hash.service';
import { SecretQaNotFoundError } from '../../../shared/errors/secret-qa-not-found.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { SecretQuestion } from '../value-objects/secret-question.vo';
import type { SecretAnswer } from '../value-objects/secret-answer.vo';
import type { SecretQaFull } from '../interfaces/secret-qa-full.interface';
import type { RecoveryQuestion } from '../interfaces/recovery-question.interface';

/** Пара «вопрос → ответ» при сверке восстановления. */
export interface AnswerAttempt {
  /** Идентификатор вопроса. */
  questionId: string;
  /** Ответ (нормализованный VO). */
  answer: SecretAnswer;
}

/**
 * Domain-service секретных вопросов (ADR-0008). Хеширует ответы (argon2id),
 * управляет набором вопросов аккаунта, выбирает K случайных и сверяет ответы.
 * Зависит только от порта репозитория и хеш-сервиса.
 */
@Injectable()
export class SecretQaDomainService {
  /**
   * @param _secretQaRepository Порт репозитория вопросов.
   * @param _hashService Хеш-сервис argon2id.
   */
  public constructor(
    @Inject(SECRET_QA_REPOSITORY) private readonly _secretQaRepository: SecretQaRepositoryPort,
    private readonly _hashService: HashService,
  ) {}

  /**
   * Добавляет вопрос (хеширует ответ).
   * @param accountId Владелец.
   * @param question Вопрос (VO).
   * @param answer Ответ (VO, нормализован).
   * @returns Созданная запись.
   */
  public async addQuestion(
    accountId: string,
    question: SecretQuestion,
    answer: SecretAnswer,
  ): Promise<SecretQaFull> {
    const answerHash = await this._hashService.hash(answer.value);
    return this._secretQaRepository.add(generateId(), { accountId, question: question.value, answerHash });
  }

  /**
   * Удаляет свой вопрос.
   * @param id Идентификатор вопроса.
   * @param accountId Владелец.
   * @throws {SecretQaNotFoundError} Если вопрос не найден/не свой.
   */
  public async removeOwn(id: string, accountId: string): Promise<void> {
    const removed = await this._secretQaRepository.removeOwn(id, accountId);
    if (!removed) {
      throw new SecretQaNotFoundError('Вопрос не найден.');
    }
  }

  /**
   * Вопросы аккаунта.
   * @param accountId Владелец.
   * @returns Записи.
   */
  public async listQuestions(accountId: string): Promise<SecretQaFull[]> {
    return this._secretQaRepository.listByAccount(accountId);
  }

  /**
   * Количество вопросов аккаунта (для валидации K).
   * @param accountId Владелец.
   * @returns Число.
   */
  public async countQuestions(accountId: string): Promise<number> {
    return this._secretQaRepository.countByAccount(accountId);
  }

  /**
   * Выбирает K случайных вопросов аккаунта (челлендж восстановления). Если
   * вопросов меньше K — вернёт сколько есть (доступность проверяет use-case).
   * @param accountId Владелец.
   * @param k Сколько выбрать.
   * @returns Вопросы (id+текст) без ответов.
   */
  public async pickRandomK(accountId: string, k: number): Promise<RecoveryQuestion[]> {
    const all = await this._secretQaRepository.listByAccount(accountId);
    // Fisher–Yates (не криптостойко — безопасность в знании ответов, не в выборке).
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = all[i]!;
      all[i] = all[j]!;
      all[j] = tmp;
    }
    return all.slice(0, k).map((row) => ({ id: row.id, question: row.question }));
  }

  /**
   * Сверяет ответы: все `questionId` должны принадлежать аккаунту, быть уникальны
   * и КАЖДЫЙ ответ совпасть с хешем. Любое расхождение → false.
   * @param accountId Владелец.
   * @param attempts Пары вопрос→ответ.
   * @returns true, если все совпали.
   */
  public async verifyAnswers(accountId: string, attempts: AnswerAttempt[]): Promise<boolean> {
    const ids = attempts.map((attempt) => attempt.questionId);
    if (ids.length === 0 || new Set(ids).size !== ids.length) {
      return false;
    }
    const rows = await this._secretQaRepository.findByIdsForAccount(ids, accountId);
    if (rows.length !== attempts.length) {
      return false;
    }
    const hashById = new Map(rows.map((row) => [row.id, row.answerHash]));
    // Проверяем ВСЕ ответы без раннего выхода — иначе по времени видно, сколько верных
    // до первой ошибки (слабый тайминг-оракул). Накапливаем результат, отдаём в конце.
    let ok = true;
    for (const attempt of attempts) {
      const hash = hashById.get(attempt.questionId);
      if (hash === undefined) {
        ok = false;
        continue;
      }
      const matched = await this._hashService.verify(hash, attempt.answer.value);
      if (!matched) {
        ok = false;
      }
    }
    return ok;
  }
}
