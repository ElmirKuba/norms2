import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_COUNTERPLAY_REPOSITORY } from '../adapters/accent-counterplay-repository.port';
import type {
  AccentCounterplayRepositoryPort,
  CounterplayUpdateData,
} from '../adapters/accent-counterplay-repository.port';
import { AccentObstacleDomainService } from './accent-obstacle.domain-service';
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
import type { CounterplayFull } from '../interfaces/counterplay-full.interface';
import { CounterplayNotFoundError } from '../../../../shared/errors/counterplay-not-found.error';
import { ValidationError } from '../../../../shared/errors/validation.error';

/** Максимум контрмер на препятствие — жёсткий предел (защита БД). */
const COUNTERPLAYS_HARD_MAX = 20;
/** Максимум длины текста контрмеры (совпадает с DTO — защита-в-глубину). */
const TEXT_MAX = 500;

/** Данные создания контрмеры на уровне домена. */
export interface CounterplayCreateInput {
  /** Препятствие-родитель. */
  obstacleId: string;
  /** Владелец (для проверки владения препятствием и микро-победой). */
  accountId: string;
  /** Текст ответа. */
  text: string;
  /** Привязанная микро-победа (опц.). */
  linkedMicroWinId?: string | null;
}

/** Данные обновления контрмеры на уровне домена. */
export interface CounterplayUpdateInput {
  text?: string | undefined;
  linkedMicroWinId?: string | null | undefined;
}

/**
 * Domain-service контрмер — «своих готовых ответов» на препятствие (domain-model §8, ADR-0062).
 *
 * **Кросс-домен строго вниз:** зависит от `AccentMicroWinDomainService`, чтобы проверить
 * привязку `linkedMicroWinId` (существует и принадлежит тому же аккаунту). Обратной ссылки нет —
 * микро-победы про препятствия не знают, поэтому круговой зависимости не возникает.
 *
 * Владение здесь двухступенчатое: сначала проверяется препятствие (оно знает аккаунт), затем
 * контрмера ищется **в пределах** этого препятствия. Так чужая контрмера недостижима, даже если
 * её идентификатор угадан.
 */
@Injectable()
export class AccentCounterplayDomainService {
  /**
   * @param _repository Порт репозитория контрмер.
   * @param _obstacles Domain-service препятствий (владение родителем).
   * @param _microWins Domain-service микро-побед (проверка привязки; кросс-домен вниз).
   */
  public constructor(
    @Inject(ACCENT_COUNTERPLAY_REPOSITORY)
    private readonly _repository: AccentCounterplayRepositoryPort,
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _microWins: AccentMicroWinDomainService,
  ) {}

  /**
   * Контрмеры препятствия (в ручном порядке).
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Список контрмер.
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   */
  public async list(obstacleId: string, accountId: string): Promise<CounterplayFull[]> {
    await this._obstacles.getOwned(obstacleId, accountId);
    return this._repository.listByObstacle(obstacleId);
  }

  /**
   * Добавляет контрмеру к препятствию.
   * @param input Данные создания.
   * @returns Созданная контрмера.
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   * @throws {ValidationError} Пустой текст, превышен предел, битая привязка или пример-витрина.
   */
  public async create(input: CounterplayCreateInput): Promise<CounterplayFull> {
    const obstacle = await this._obstacles.getOwned(input.obstacleId, input.accountId);
    // Инертная витрина (ADR-0051): пример нельзя наполнять своими ответами до присвоения,
    // иначе человек вложится в карточку, которая формально ещё не его.
    if (obstacle.isStarter) {
      throw new ValidationError('Это пример — сначала «Добавить себе».');
    }
    this._validateText(input.text);
    await this._validateLink(input.linkedMicroWinId, input.accountId);
    const existing = await this._repository.countInObstacle(input.obstacleId);
    if (existing >= COUNTERPLAYS_HARD_MAX) {
      throw new ValidationError(
        `Контрмер у одного препятствия не может быть больше ${String(COUNTERPLAYS_HARD_MAX)}.`,
      );
    }
    return this._repository.create({
      obstacleId: input.obstacleId,
      text: input.text.trim(),
      linkedMicroWinId: input.linkedMicroWinId ?? null,
    });
  }

  /**
   * Правит контрмеру (текст и/или привязку к микро-победе).
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param input Поля для обновления.
   * @returns Обновлённая контрмера.
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   * @throws {CounterplayNotFoundError} Если контрмеры нет в этом препятствии.
   * @throws {ValidationError} Пустой текст или битая привязка.
   */
  public async update(
    id: string,
    obstacleId: string,
    accountId: string,
    input: CounterplayUpdateInput,
  ): Promise<CounterplayFull> {
    await this._obstacles.getOwned(obstacleId, accountId);
    if (input.text !== undefined) {
      this._validateText(input.text);
    }
    if (input.linkedMicroWinId !== undefined) {
      await this._validateLink(input.linkedMicroWinId, accountId);
    }
    const patch: CounterplayUpdateData = {
      ...input,
      ...(input.text === undefined ? {} : { text: input.text.trim() }),
    };
    const updated = await this._repository.update(id, obstacleId, patch);
    if (!updated) {
      throw new CounterplayNotFoundError('Контрмера не найдена.');
    }
    return updated;
  }

  /**
   * Удаляет контрмеру. Записи журнала, где она применялась, остаются — теряется лишь
   * «чем ответил» (SET NULL): факт столкновения важнее ссылки.
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @param accountId Идентификатор аккаунта-владельца.
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   * @throws {CounterplayNotFoundError} Если контрмеры нет в этом препятствии.
   */
  public async remove(id: string, obstacleId: string, accountId: string): Promise<void> {
    await this._obstacles.getOwned(obstacleId, accountId);
    const deleted = await this._repository.delete(id, obstacleId);
    if (!deleted) {
      throw new CounterplayNotFoundError('Контрмера не найдена.');
    }
  }

  /**
   * Ручная сортировка контрмер (ADR-0054). Авто-сортировки по действенности нет — список не
   * должен прыгать под руками (ADR-0062 п.7).
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   */
  public async reorder(
    obstacleId: string,
    accountId: string,
    ids: readonly string[],
  ): Promise<void> {
    await this._obstacles.getOwned(obstacleId, accountId);
    await this._repository.reorder(obstacleId, ids);
  }

  /**
   * Счётчики контрмер для набора препятствий (для `counterplaysCount` в списке).
   * @param obstacleIds Идентификаторы препятствий.
   * @returns Карта `obstacleId → число контрмер`.
   */
  public async countByObstacles(obstacleIds: readonly string[]): Promise<Map<string, number>> {
    return this._repository.countByObstacles(obstacleIds);
  }

  /**
   * Проверяет текст контрмеры.
   * @param text Текст.
   * @throws {ValidationError} Если пустой или слишком длинный.
   */
  private _validateText(text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Текст контрмеры обязателен.');
    }
    if (trimmed.length > TEXT_MAX) {
      throw new ValidationError(`Текст контрмеры: максимум ${String(TEXT_MAX)}.`);
    }
  }

  /**
   * Проверяет привязку к микро-победе через её domain-service (кросс-домен вниз): она должна
   * существовать и принадлежать тому же аккаунту. `null` — снятие привязки, проверять нечего.
   * @param microWinId Идентификатор микро-победы или null/undefined.
   * @param accountId Идентификатор аккаунта-владельца.
   * @throws {ValidationError} Если микро-победа не найдена / чужая.
   */
  private async _validateLink(
    microWinId: string | null | undefined,
    accountId: string,
  ): Promise<void> {
    if (microWinId === null || microWinId === undefined) {
      return;
    }
    try {
      await this._microWins.getOwned(microWinId, accountId);
    } catch {
      // Чужая или несуществующая — для клиента это одно и то же (чужие не раскрываем).
      throw new ValidationError('Микро-победа не найдена.');
    }
  }
}
