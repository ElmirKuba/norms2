import { Injectable, Logger } from '@nestjs/common';

/** Шаги анкеты по порядку. */
export type DraftStep = 'name' | 'age' | 'gender' | 'why' | 'purpose' | 'login';

/** Что человек просит. */
export type DraftKind = 'join' | 'more_invites' | 'unban';

/**
 * Порядок шагов по типу заявки — единственный источник истины о том, что идёт за чем.
 *
 * У просьбы о приглашениях **один вопрос, а не четыре**: человек уже внутри, его имя и возраст
 * владелец знает по аккаунту. Спрашивать их заново — собирать личные данные без повода.
 */
export const DRAFT_STEPS: Record<DraftKind, readonly DraftStep[]> = {
  join: ['name', 'age', 'gender', 'why'],
  more_invites: ['purpose'],
  // У просьбы о разбане тоже один вопрос — логин. Причину не спрашиваем: она уже записана тем,
  // кто банил, и админ смотрит на неё, а не на версию забаненного.
  unban: ['login'],
};

/** Сколько живёт недособранный черновик. */
const TTL_MS = 30 * 60 * 1000;

/** Как часто выметаем протухшее. */
const SWEEP_MS = 5 * 60 * 1000;

/** Недособранная заявка. */
export interface RequestDraft {
  /** Что человек просит — от этого зависит набор вопросов. */
  kind: DraftKind;
  /** Текущий шаг. */
  step: DraftStep;
  /** Уже собранные ответы по шагам. */
  answers: Partial<Record<DraftStep, string>>;
  /** Когда черновик последний раз трогали. */
  touchedAt: number;
}

/**
 * Черновики заявок — **в памяти процесса, не в БД** (2.9.1·10,
 * [ADR-0064 §10](../../../../docs/decisions/0064-telegram-release-channel.md)).
 *
 * Пока человек отвечает на вопросы, его имя, возраст, пол и «зачем» существуют только здесь.
 * Запись в базу появляется **в момент отправки владельцу** и содержит карточку без текста.
 * Так «мы не храним персональные данные» остаётся правдой даже про недособранные анкеты.
 *
 * **Цена принята заранее и честно названа:** деплой или рестарт посреди диалога — «сессия
 * прервалась, начни заново». Это осознанный обмен: альтернатива — писать ПДн на диск ради
 * удобства в редком случае.
 *
 * TTL 30 минут не только про память: брошенный час назад черновик человек уже не помнит, и
 * продолжать его — значит спрашивать «а на чём мы остановились» вместо ответа.
 */
@Injectable()
export class RequestDraftStore {
  private readonly _logger = new Logger('RequestDraft');
  private readonly _drafts = new Map<string, RequestDraft>();

  public constructor() {
    // Без подметания Map растёт на каждого, кто начал и бросил. `unref` — чтобы таймер не
    // держал процесс живым при остановке приложения.
    setInterval(() => this._sweep(), SWEEP_MS).unref();
  }

  /**
   * Начинает новый черновик, затирая прежний.
   * @param chatId Чат.
   * @param kind Тип заявки (определяет набор вопросов).
   * @returns Созданный черновик.
   */
  public start(chatId: string, kind: DraftKind): RequestDraft {
    const first = DRAFT_STEPS[kind][0] ?? 'why';
    const draft: RequestDraft = { kind, step: first, answers: {}, touchedAt: Date.now() };
    this._drafts.set(chatId, draft);
    return draft;
  }

  /**
   * Текущий черновик, если он жив.
   * @param chatId Чат.
   * @returns Черновик или null (в том числе если протух).
   */
  public get(chatId: string): RequestDraft | null {
    const draft = this._drafts.get(chatId);
    if (draft === undefined) {
      return null;
    }
    if (Date.now() - draft.touchedAt > TTL_MS) {
      this._drafts.delete(chatId);
      return null;
    }
    return draft;
  }

  /**
   * Записывает ответ и переводит на следующий шаг.
   * @param chatId Чат.
   * @param answer Ответ на текущий шаг.
   * @returns Обновлённый черновик или null, если черновика уже нет.
   */
  public advance(chatId: string, answer: string): RequestDraft | null {
    const draft = this.get(chatId);
    if (draft === null) {
      return null;
    }
    draft.answers[draft.step] = answer;
    const steps = DRAFT_STEPS[draft.kind];
    const next = steps[steps.indexOf(draft.step) + 1];
    if (next !== undefined) {
      draft.step = next;
    }
    draft.touchedAt = Date.now();
    return draft;
  }

  /**
   * Все ли шаги пройдены.
   * @param draft Черновик.
   * @returns Признак готовности.
   */
  public isComplete(draft: RequestDraft): boolean {
    return DRAFT_STEPS[draft.kind].every((step) => draft.answers[step] !== undefined);
  }

  /**
   * Забывает черновик (отправлен или отменён).
   * @param chatId Чат.
   * @returns Промис не нужен — операция синхронная.
   */
  public forget(chatId: string): void {
    this._drafts.delete(chatId);
  }

  /** Выметает протухшие черновики. */
  private _sweep(): void {
    const now = Date.now();
    let removed = 0;
    for (const [chatId, draft] of this._drafts) {
      if (now - draft.touchedAt > TTL_MS) {
        this._drafts.delete(chatId);
        removed += 1;
      }
    }
    if (removed > 0) {
      this._logger.log(`Выметено протухших черновиков: ${removed}.`);
    }
  }
}
