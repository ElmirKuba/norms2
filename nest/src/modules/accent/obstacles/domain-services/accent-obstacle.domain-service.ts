import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCENT_OBSTACLE_REPOSITORY } from '../adapters/accent-obstacle-repository.port';
import type {
  AccentObstacleRepositoryPort,
  ObstacleUpdateData,
} from '../adapters/accent-obstacle-repository.port';
import type { ObstacleFull, ObstacleType } from '../interfaces/obstacle-full.interface';
import { ACCENT_COUNTERPLAY_REPOSITORY } from '../adapters/accent-counterplay-repository.port';
import type { AccentCounterplayRepositoryPort } from '../adapters/accent-counterplay-repository.port';
import { STARTER_OBSTACLES } from '../seed/starter-obstacles';
import { ObstacleNotFoundError } from '../../../../shared/errors/obstacle-not-found.error';
import { ValidationError } from '../../../../shared/errors/validation.error';
import type { Env } from '../../../../system/config/env.schema';

/** Максимум препятствий на аккаунт — жёсткий предел (защита БД, не воспитание). */
const OBSTACLES_HARD_MAX = 200;
/** Границы самооценки «насколько давит». */
const INTENSITY_MIN = 1;
const INTENSITY_MAX = 5;
/** Максимум длины названия (совпадает с DTO — защита-в-глубину). */
const NAME_MAX = 160;

/** Данные создания препятствия на уровне домена. */
export interface ObstacleCreateInput {
  /** Владелец. */
  accountId: string;
  /** Название. */
  name: string;
  /** Вид препятствия (обязателен). */
  type: ObstacleType;
  /** Сфера жизни (опц.). */
  domainKey?: string | null;
  /** Повод (опц.). */
  trigger?: string | null;
  /** Признаки (опц.). */
  symptoms?: string | null;
  /** Насколько давит 1..5 (опц., дефолт 3). */
  intensity?: number;
}

/** Данные обновления препятствия на уровне домена (без служебного `isStarter`). */
export interface ObstacleUpdateInput {
  name?: string | undefined;
  type?: ObstacleType | undefined;
  domainKey?: string | null | undefined;
  trigger?: string | null | undefined;
  symptoms?: string | null | undefined;
  intensity?: number | undefined;
  isActive?: boolean | undefined;
}

/** Список препятствий + признак превышения мягкого порога (для подсказки на фронте). */
export interface ObstacleListResult {
  /** Препятствия в ручном порядке. */
  items: ObstacleFull[];
  /** Активных больше `ACCENT_OBSTACLE_SOFT_LIMIT` — подсказка, НЕ запрет (ADR-0062 п.8). */
  softLimitExceeded: boolean;
}

/**
 * Domain-service препятствий (domain-model §8, ADR-0062). CRUD + архив + ручная сортировка.
 *
 * **Что домен здесь охраняет:**
 * - владение (чужое = «не найдено», чужие id не раскрываем);
 * - инварианты значения (`type` из словаря, `intensity` 1..5, длины) — дублируют DTO осознанно:
 *   DTO защищает границу HTTP, домен остаётся правдой при любом вызывающем;
 * - **разницу между мягким и жёстким лимитом**: `ACCENT_OBSTACLE_SOFT_LIMIT` только помечает
 *   список флагом (подсказка «может, часть в архив?»), а отказать может лишь жёсткий предел
 *   в 200 строк — он про защиту БД, а не про воспитание человека;
 * - **инертность примеров** (ADR-0051): правка примера присваивает его (`is_starter → false`),
 *   а не оставляет витриной.
 *
 * Частота столкновений и действенность контрмер здесь не считаются — они вычисляются на чтение
 * в своих слайсах (блоки C/D, ADR-0052). Domain-service препятствий про журнал не знает.
 */
@Injectable()
export class AccentObstacleDomainService {
  /**
   * @param _repository Порт репозитория препятствий.
   * @param _counterplays Порт контрмер (примеры сеются сразу с готовыми ответами).
   * @param _config Конфиг (мягкий порог активных).
   */
  public constructor(
    @Inject(ACCENT_OBSTACLE_REPOSITORY) private readonly _repository: AccentObstacleRepositoryPort,
    @Inject(ACCENT_COUNTERPLAY_REPOSITORY)
    private readonly _counterplays: AccentCounterplayRepositoryPort,
    private readonly _config: ConfigService<Env, true>,
  ) {}

  /**
   * Список препятствий аккаунта + признак превышения мягкого порога.
   * @param accountId Идентификатор аккаунта.
   * @param includeArchived Включать ли архивные.
   * @returns Препятствия в ручном порядке и флаг подсказки.
   */
  public async list(accountId: string, archived = false): Promise<ObstacleListResult> {
    const items = await this._repository.listByAccount(accountId, archived);
    const softLimit = this._config.get('ACCENT_OBSTACLE_SOFT_LIMIT', { infer: true });
    const activeOwn = items.filter((o) => o.isActive && !o.isStarter).length;
    return { items, softLimitExceeded: activeOwn > softLimit };
  }

  /**
   * Возвращает препятствие владельца или бросает 404.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Препятствие.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async getOwned(id: string, accountId: string): Promise<ObstacleFull> {
    const found = await this._repository.findOwned(id, accountId);
    if (!found) {
      throw new ObstacleNotFoundError('Препятствие не найдено.');
    }
    return found;
  }

  /**
   * Переносит препятствие в архив или возвращает из него.
   *
   * **Архив — состояние продукта, и у него обязаны быть оба перехода**
   * ([ADR-0068](../../../../../docs/decisions/0068-deletion-belongs-to-storage.md)). До 2.9.3
   * вход был, выхода не было: «Убрать из списка» звучало обратимо, а возврата не существовало
   * ни на экране, ни в контракте.
   * @param id Идентификатор препятствия.
   * @param accountId Владелец.
   * @param archived `true` — в архив, `false` — вернуть в работу.
   * @returns Обновлённое препятствие.
   * @throws {ObstacleNotFoundError} Если чужое или не существует.
   */
  public async setArchived(id: string, accountId: string, archived: boolean): Promise<ObstacleFull> {
    await this.getOwned(id, accountId);
    const updated = await this._repository.update(id, accountId, { isActive: !archived });
    if (updated === null) {
      throw new ObstacleNotFoundError('Препятствие не найдено.');
    }
    return updated;
  }

  /**
   * Создаёт препятствие. Мягкий порог НЕ мешает созданию (ADR-0062 п.8) — отказ возможен
   * только по жёсткому пределу.
   * @param input Данные создания.
   * @returns Созданное препятствие.
   * @throws {ValidationError} Инварианты значения или жёсткий предел.
   */
  public async create(input: ObstacleCreateInput): Promise<ObstacleFull> {
    this._validateName(input.name);
    this._validateIntensity(input.intensity);
    const existing = await this._repository.listByAccount(input.accountId, true);
    if (existing.length >= OBSTACLES_HARD_MAX) {
      throw new ValidationError(`Препятствий не может быть больше ${String(OBSTACLES_HARD_MAX)}.`);
    }
    return this._repository.create({
      accountId: input.accountId,
      name: input.name.trim(),
      type: input.type,
      domainKey: input.domainKey ?? null,
      trigger: input.trigger ?? null,
      symptoms: input.symptoms ?? null,
      ...(input.intensity === undefined ? {} : { intensity: input.intensity }),
    });
  }

  /**
   * Обновляет препятствие владельца. Правка примера **присваивает** его (ADR-0051): витрина
   * превращается в своё, иначе человек правил бы чужую заготовку и не понимал, почему она
   * ведёт себя инертно.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param input Поля для обновления.
   * @returns Обновлённое препятствие.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   * @throws {ValidationError} Инварианты значения.
   */
  public async update(
    id: string,
    accountId: string,
    input: ObstacleUpdateInput,
  ): Promise<ObstacleFull> {
    const current = await this.getOwned(id, accountId);
    if (input.name !== undefined) {
      this._validateName(input.name);
    }
    this._validateIntensity(input.intensity);
    const patch: ObstacleUpdateData = {
      ...input,
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      // Adoption: правка примера снимает флаг витрины (ADR-0051).
      ...(current.isStarter ? { isStarter: false } : {}),
    };
    const updated = await this._repository.update(id, accountId, patch);
    if (!updated) {
      throw new ObstacleNotFoundError('Препятствие не найдено.');
    }
    return updated;
  }

  /**
   * Полностью удаляет препятствие (контрмеры и журнал — каскадом; ссылки из истории «Держусь»
   * обнуляются). Мягкий путь — архив (`isActive:false`) через `update`.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async remove(id: string, accountId: string): Promise<void> {
    const deleted = await this._repository.delete(id, accountId);
    if (!deleted) {
      throw new ObstacleNotFoundError('Препятствие не найдено.');
    }
  }

  /**
   * Ручная сортировка (ADR-0054). Чужие id репозиторий игнорирует (скоуп по аккаунту).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    await this._repository.reorder(accountId, ids);
  }

  /**
   * Сеет стартовые примеры (ADR-0051). Идемпотентно: дедуп по названию, только докидывает
   * недостающие. Каждый пример приходит **с готовыми ответами** — иначе витрина показывала бы
   * пустую карточку и не объясняла, зачем раздел нужен.
   * @param accountId Идентификатор аккаунта.
   * @returns Сколько препятствий засеяно.
   */
  public async seedStarterPack(accountId: string): Promise<number> {
    const existing = await this._repository.listByAccount(accountId, true);
    const names = new Set(existing.map((o) => o.name));
    const missing = STARTER_OBSTACLES.filter((item) => !names.has(item.name));
    let seeded = 0;
    for (const item of missing) {
      const created = await this._repository.create({
        accountId,
        name: item.name,
        type: item.type,
        trigger: item.trigger,
        symptoms: item.symptoms,
        isStarter: true,
      });
      await this._counterplays.createMany(
        item.counterplays.map((text) => ({ obstacleId: created.id, text })),
      );
      seeded += 1;
    }
    return seeded;
  }

  /**
   * Очищает непринятые примеры; присвоенные не трогает (ADR-0051). Контрмеры примеров уходят
   * каскадом вместе с ними.
   * @param accountId Идентификатор аккаунта.
   * @returns Сколько удалено.
   */
  public async clearStarters(accountId: string): Promise<number> {
    return this._repository.deleteStarters(accountId);
  }

  /**
   * «Добавить себе» — снимает флаг витрины, и пример становится обычным препятствием со всеми
   * своими ответами. Счётчик столкновений при этом начинается с нуля: до присвоения на примере
   * ничего не писалось.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Присвоенное препятствие.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async adopt(id: string, accountId: string): Promise<ObstacleFull> {
    await this.getOwned(id, accountId);
    const updated = await this._repository.update(id, accountId, { isStarter: false });
    if (!updated) {
      throw new ObstacleNotFoundError('Препятствие не найдено.');
    }
    return updated;
  }

  /**
   * Проверяет название (непустое, не длиннее предела).
   * @param name Название.
   * @throws {ValidationError} Если пустое или слишком длинное.
   */
  private _validateName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Название обязательно.');
    }
    if (trimmed.length > NAME_MAX) {
      throw new ValidationError(`Название: максимум ${String(NAME_MAX)}.`);
    }
  }

  /**
   * Проверяет самооценку «насколько давит» (1..5), если она задана.
   * @param intensity Значение или undefined.
   * @throws {ValidationError} Если вне диапазона или не целое.
   */
  private _validateIntensity(intensity: number | undefined): void {
    if (intensity === undefined) {
      return;
    }
    if (!Number.isInteger(intensity) || intensity < INTENSITY_MIN || intensity > INTENSITY_MAX) {
      throw new ValidationError(
        `Насколько давит: целое от ${String(INTENSITY_MIN)} до ${String(INTENSITY_MAX)}.`,
      );
    }
  }
}
