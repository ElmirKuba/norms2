import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY } from '../adapters/accent-obstacle-encounter-repository.port';
import type {
  AccentObstacleEncounterRepositoryPort,
  CounterplayEffectiveness,
  EncounterCursor,
} from '../adapters/accent-obstacle-encounter-repository.port';
import { ACCENT_COUNTERPLAY_REPOSITORY } from '../adapters/accent-counterplay-repository.port';
import type { AccentCounterplayRepositoryPort } from '../adapters/accent-counterplay-repository.port';
import { AccentObstacleDomainService } from './accent-obstacle.domain-service';
import type {
  EncounterOutcome,
  ObstacleEncounterFull,
} from '../interfaces/obstacle-encounter-full.interface';
import { EncounterNotFoundError } from '../../../../shared/errors/encounter-not-found.error';
import { ValidationError } from '../../../../shared/errors/validation.error';

/** Окно для «мешал N раз» — 30 суток в миллисекундах. */
const WINDOW_MS = 30 * 86_400_000;
/** Максимум длины заметки (совпадает с DTO — защита-в-глубину). */
const NOTE_MAX = 2000;

/** Данные записи столкновения на уровне домена. */
export interface EncounterCreateInput {
  /** Препятствие. */
  obstacleId: string;
  /** Владелец (проверка владения препятствием). */
  accountId: string;
  /** Чем ответил (опц.). */
  counterplayId?: string | null;
  /** Исход (опц., можно позже). */
  outcome?: EncounterOutcome | null;
  /** Заметка (опц.). */
  note?: string | null;
  /** Момент (unix ms, опц.; по умолчанию — сейчас). */
  occurredAt?: number | null;
}

/**
 * Domain-service журнала столкновений (domain-model §8, ADR-0062). Журнал **append-only**:
 * записи не редактируются и не удаляются, единственное изменение — проставить `outcome`
 * задним числом.
 *
 * Отсюда берутся обе вычисляемые на чтение величины раздела (ADR-0052, хранимых счётчиков нет):
 * «мешал N раз за 30 дней» у препятствия и «помогало N из M» у контрмеры.
 */
@Injectable()
export class AccentObstacleEncounterDomainService {
  /**
   * @param _repository Порт журнала столкновений.
   * @param _counterplays Порт контрмер (проверка, что ответ принадлежит этому препятствию).
   * @param _obstacles Domain-service препятствий (владение).
   */
  public constructor(
    @Inject(ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY)
    private readonly _repository: AccentObstacleEncounterRepositoryPort,
    @Inject(ACCENT_COUNTERPLAY_REPOSITORY)
    private readonly _counterplays: AccentCounterplayRepositoryPort,
    private readonly _obstacles: AccentObstacleDomainService,
  ) {}

  /**
   * Записывает столкновение — главный поток раздела. Ничего обязательного: без контрмеры это
   * «просто отметить», без исхода — «оценю позже (или никогда)».
   * @param input Данные записи.
   * @returns Созданная запись.
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   * @throws {ValidationError} Пример-витрина, чужая контрмера или слишком длинная заметка.
   */
  public async record(input: EncounterCreateInput): Promise<ObstacleEncounterFull> {
    const obstacle = await this._obstacles.getOwned(input.obstacleId, input.accountId);
    // Инертная витрина (ADR-0051): на примере счётчик не растёт — иначе статистика человека
    // окажется засорена карточками, которые он не выбирал.
    if (obstacle.isStarter) {
      throw new ValidationError('Это пример — сначала «Добавить себе».');
    }
    if (input.note !== null && input.note !== undefined && input.note.length > NOTE_MAX) {
      throw new ValidationError(`Заметка: максимум ${String(NOTE_MAX)}.`);
    }
    if (input.counterplayId !== null && input.counterplayId !== undefined) {
      const counterplay = await this._counterplays.findInObstacle(
        input.counterplayId,
        input.obstacleId,
      );
      if (!counterplay) {
        throw new ValidationError('Контрмера не найдена.');
      }
    }
    return this._repository.insert({
      obstacleId: input.obstacleId,
      occurredAt: input.occurredAt ?? Date.now(),
      counterplayId: input.counterplayId ?? null,
      outcome: input.outcome ?? null,
      note: input.note ?? null,
    });
  }

  /**
   * Страница ленты столкновений (новые→старые).
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param limit Сколько записей на страницу.
   * @param cursor Курсор или null.
   * @returns Записи (ровно `limit+1` при наличии следующей — признак «есть ещё»).
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   */
  public async list(
    obstacleId: string,
    accountId: string,
    limit: number,
    cursor: EncounterCursor | null,
  ): Promise<ObstacleEncounterFull[]> {
    await this._obstacles.getOwned(obstacleId, accountId);
    // Тянем на одну больше запрошенного — так узнаём о следующей странице без COUNT(*).
    return this._repository.listByObstacle(obstacleId, { limit: limit + 1, cursor });
  }

  /**
   * Проставляет исход задним числом (единственный modify в append-only журнале).
   * @param id Идентификатор записи.
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param outcome Исход.
   * @returns Обновлённая запись.
   * @throws {ObstacleNotFoundError} Если препятствие не найдено / не ваше.
   * @throws {EncounterNotFoundError} Если записи нет в этом препятствии.
   */
  public async setOutcome(
    id: string,
    obstacleId: string,
    accountId: string,
    outcome: EncounterOutcome,
  ): Promise<ObstacleEncounterFull> {
    await this._obstacles.getOwned(obstacleId, accountId);
    const updated = await this._repository.setOutcome(id, obstacleId, outcome);
    if (!updated) {
      throw new EncounterNotFoundError('Запись не найдена.');
    }
    return updated;
  }

  /**
   * «Мешал N раз за 30 дней» для набора препятствий (вычисление на чтение).
   * @param obstacleIds Идентификаторы препятствий.
   * @param now Текущий момент (unix ms).
   * @returns Карта `obstacleId → число столкновений в окне`.
   */
  public async countsLast30(
    obstacleIds: readonly string[],
    now: number = Date.now(),
  ): Promise<Map<string, number>> {
    return this._repository.countSince(obstacleIds, now - WINDOW_MS);
  }

  /**
   * Действенность контрмер препятствия («помогало N из M»).
   * @param obstacleId Идентификатор препятствия.
   * @returns Строки по контрмерам с оценёнными применениями.
   */
  public async effectiveness(obstacleId: string): Promise<CounterplayEffectiveness[]> {
    return this._repository.effectivenessByObstacle(obstacleId);
  }
}
