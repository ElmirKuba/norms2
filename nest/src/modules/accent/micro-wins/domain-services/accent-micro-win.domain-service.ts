import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { MicroWinNotFoundError } from '../../../../shared/errors/micro-win-not-found.error';
import { ACCENT_MICRO_WIN_REPOSITORY } from '../adapters/accent-micro-win-repository.port';
import type {
  AccentMicroWinRepositoryPort,
  MicroWinCreateData,
  MicroWinUpdateData,
} from '../adapters/accent-micro-win-repository.port';
import {
  MICRO_WIN_CATEGORIES,
  USER_STATES,
} from '../interfaces/micro-win-full.interface';
import { STARTER_MICRO_WINS } from '../seed/starter-micro-wins';
import type {
  MicroWinCategory,
  MicroWinFull,
  UserState,
} from '../interfaces/micro-win-full.interface';

/** Максимальная длина названия микро-победы. */
const TITLE_MAX = 120;
/** Верхняя граница длительности (секунды) — синхронно с CHECK в схеме. */
const DURATION_MAX = 300;
/** Границы цены энергии — синхронно с CHECK в схеме. */
const ENERGY_MIN = 1;
const ENERGY_MAX = 3;

/**
 * Domain-service микро-побед: per-account CRUD с инвариантами и проверкой владения.
 * Зависит только от порта репозитория (чистые границы). Инварианты (title, duration
 * 0..300, energy 1..3, category/состояния из справочника) дублируют DB-CHECK дружелюбной
 * ошибкой `VALIDATION_ERROR` до похода в БД. Экспортится из `MicroWinsModule` для
 * кросс-домена вниз (Recommender «Сейчас» в survival/recovery — подфаза 2.7).
 */
@Injectable()
export class AccentMicroWinDomainService {
  /**
   * @param _repository Порт репозитория микро-побед.
   */
  public constructor(
    @Inject(ACCENT_MICRO_WIN_REPOSITORY) private readonly _repository: AccentMicroWinRepositoryPort,
  ) {}

  /**
   * Активные микро-победы аккаунта.
   * @param accountId Идентификатор аккаунта.
   * @returns Список микро-побед владельца.
   */
  public async list(accountId: string): Promise<MicroWinFull[]> {
    return this._repository.listByAccount(accountId);
  }

  /**
   * Ручная сортировка микро-побед (ADR-0054, drag-reorder). Репозиторий скоупит по аккаунту.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок.
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    await this._repository.reorder(accountId, ids);
  }

  /**
   * Микро-победа владельца или ошибка 404.
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Микро-победа.
   * @throws {MicroWinNotFoundError} Если нет / не ваша.
   */
  public async getOwned(id: string, accountId: string): Promise<MicroWinFull> {
    const found = await this._repository.findOwned(id, accountId);
    if (!found) {
      throw new MicroWinNotFoundError('Микро-победа не найдена.');
    }
    return found;
  }

  /**
   * Создаёт микро-победу после валидации инвариантов.
   * @param data Данные создания (с `accountId`).
   * @returns Созданная микро-победа.
   * @throws {ValidationError} При нарушении инвариантов.
   */
  public async create(data: MicroWinCreateData): Promise<MicroWinFull> {
    const title = this._validateTitle(data.title);
    this._validateCategory(data.category);
    this._validateDuration(data.durationSeconds);
    this._validateEnergy(data.energyCost);
    this._validateStates(data.disabledForStates);
    return this._repository.create({ ...data, title });
  }

  /**
   * Обновляет микро-победу владельца (валидирует только переданные поля).
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая микро-победа.
   * @throws {ValidationError} При нарушении инвариантов.
   * @throws {MicroWinNotFoundError} Если нет / не ваша.
   */
  public async update(
    id: string,
    accountId: string,
    patch: MicroWinUpdateData,
  ): Promise<MicroWinFull> {
    // Собираем чистый патч только из переданных ключей (без утечки undefined в Drizzle .set()).
    const clean: MicroWinUpdateData = {};
    if (patch.title !== undefined) {
      clean.title = this._validateTitle(patch.title);
    }
    if (patch.category !== undefined) {
      this._validateCategory(patch.category);
      clean.category = patch.category;
    }
    if (patch.domainKey !== undefined) {
      clean.domainKey = patch.domainKey;
    }
    if (patch.prepSeconds !== undefined) {
      clean.prepSeconds = patch.prepSeconds;
    }
    if (patch.durationSeconds !== undefined) {
      this._validateDuration(patch.durationSeconds);
      clean.durationSeconds = patch.durationSeconds;
    }
    if (patch.energyCost !== undefined) {
      this._validateEnergy(patch.energyCost);
      clean.energyCost = patch.energyCost;
    }
    if (patch.effect !== undefined) {
      clean.effect = patch.effect;
    }
    if (patch.disabledForStates !== undefined) {
      this._validateStates(patch.disabledForStates);
      clean.disabledForStates = patch.disabledForStates;
    }
    if (patch.isActive !== undefined) {
      clean.isActive = patch.isActive;
    }
    // Adoption (2.3): любое редактирование «присваивает» стартовую победу (снимает флаг).
    clean.isStarter = false;
    const updated = await this._repository.update(id, accountId, clean);
    if (!updated) {
      throw new MicroWinNotFoundError('Микро-победа не найдена.');
    }
    return updated;
  }

  /**
   * Удаляет микро-победу владельца.
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @throws {MicroWinNotFoundError} Если нет / не ваша.
   */
  public async remove(id: string, accountId: string): Promise<void> {
    const deleted = await this._repository.remove(id, accountId);
    if (!deleted) {
      throw new MicroWinNotFoundError('Микро-победа не найдена.');
    }
  }

  /**
   * Отмечает выполнение микро-победы за день (идемпотентно по дню — дневной лимит).
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param occurredOn Локальная дата `YYYY-MM-DD` (вычисляет use-case по TZ аккаунта).
   * @returns Победа и флаг `newlyCompleted` (false если уже было сегодня).
   * @throws {MicroWinNotFoundError} Если нет / не ваша.
   */
  public async complete(
    id: string,
    accountId: string,
    occurredOn: string,
  ): Promise<{ microWin: MicroWinFull; newlyCompleted: boolean }> {
    let microWin = await this.getOwned(id, accountId);
    const newlyCompleted = await this._repository.logCompletion(accountId, id, occurredOn);
    // Adoption (2.3): первое выполнение стартовой победы «присваивает» её (снимает флаг).
    if (microWin.isStarter) {
      microWin = (await this._repository.update(id, accountId, { isStarter: false })) ?? microWin;
    }
    // TODO: Claude Code: 2026-06-16: 2.9 (геймификация) — при newlyCompleted эмитить
    // доменное событие `micro_win.completed`; листенер начислит очки. Сейчас механизма
    // событий нет (event-emitter не подключён) → начисление отложено до 2.9.
    return { microWin, newlyCompleted };
  }

  /**
   * Идентификаторы микро-побед, выполненных аккаунтом в указанный день.
   * @param accountId Идентификатор аккаунта.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns Множество `microWinId` с логом за день.
   */
  public async completedIdsOn(accountId: string, occurredOn: string): Promise<Set<string>> {
    return new Set(await this._repository.listLoggedOn(accountId, occurredOn));
  }

  /**
   * Засевает стартовый набор (по кнопке «Получить пак», 2.3): создаёт победы из
   * `STARTER_MICRO_WINS` с `is_starter=true`. **Только докидывает** (своё не трогает) и
   * пропускает названия, которые у аккаунта уже есть (без дублей). Данные — доверенные
   * константы, валидация не нужна.
   * @param accountId Идентификатор аккаунта.
   * @returns Число созданных стартовых побед (0 если все уже есть).
   */
  public async seedStarterPack(accountId: string): Promise<number> {
    const existing = await this._repository.listByAccount(accountId);
    const existingTitles = new Set(existing.map((win) => win.title));
    const toSeed = STARTER_MICRO_WINS.filter((item) => !existingTitles.has(item.title)).map(
      (item) => ({ ...item, accountId, isStarter: true }),
    );
    return this._repository.createMany(toSeed);
  }

  /**
   * Очищает примеры: удаляет ещё не присвоенные стартовые победы аккаунта
   * (`is_starter=true`). Свои (присвоенные) не трогает.
   * @param accountId Идентификатор аккаунта.
   * @returns Число удалённых.
   */
  public async clearStarters(accountId: string): Promise<number> {
    return this._repository.deleteStarters(accountId);
  }

  /**
   * Валидирует и нормализует название.
   * @param value Сырое название.
   * @returns Обрезанное название.
   * @throws {ValidationError} Пусто или длиннее лимита.
   */
  private _validateTitle(value: string): string {
    const title = value.trim();
    if (title.length === 0) {
      throw new ValidationError('Название микро-победы обязательно.');
    }
    if (title.length > TITLE_MAX) {
      throw new ValidationError(`Название: не длиннее ${TITLE_MAX} символов.`);
    }
    return title;
  }

  /**
   * @param value Категория.
   * @throws {ValidationError} Не из справочника.
   */
  private _validateCategory(value: MicroWinCategory): void {
    if (!MICRO_WIN_CATEGORIES.includes(value)) {
      throw new ValidationError('Недопустимая категория микро-победы.');
    }
  }

  /**
   * @param value Длительность в секундах.
   * @throws {ValidationError} Не целое или вне 0..300.
   */
  private _validateDuration(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > DURATION_MAX) {
      throw new ValidationError(`Длительность: целое 0..${DURATION_MAX} секунд.`);
    }
  }

  /**
   * @param value Цена энергии.
   * @throws {ValidationError} Не целое или вне 1..3.
   */
  private _validateEnergy(value: number): void {
    if (!Number.isInteger(value) || value < ENERGY_MIN || value > ENERGY_MAX) {
      throw new ValidationError(`Цена энергии: целое ${ENERGY_MIN}..${ENERGY_MAX}.`);
    }
  }

  /**
   * @param value Список состояний или null/undefined.
   * @throws {ValidationError} Есть значение не из `USER_STATES`.
   */
  private _validateStates(value: UserState[] | null | undefined): void {
    if (!value) {
      return;
    }
    for (const state of value) {
      if (!USER_STATES.includes(state)) {
        throw new ValidationError('Недопустимое состояние в disabledForStates.');
      }
    }
  }
}
