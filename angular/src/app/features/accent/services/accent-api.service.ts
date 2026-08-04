import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type {
  AccentRefItem,
  AccentSettingsView,
  AddGoalEntryResult,
  AntiHabitEventPage,
  CompleteMinimumResult,
  CounterplayPayload,
  CounterplayUpdatePayload,
  CounterplayView,
  DashboardView,
  StatsView,
  EncounterPayload,
  EncounterRecordResult,
  ObstacleEncounterPage,
  ObstacleEncounterView,
  ObstacleListView,
  ObstaclePayload,
  ObstacleUpdatePayload,
  ObstacleView,
  AntiHabitPayload,
  AntiHabitUpdatePayload,
  AntiHabitView,
  CompleteTaskResult,
  GoalEntryPayload,
  GoalEntryView,
  GoalFocusResult,
  GoalPayload,
  GoalProgressView,
  GoalStatus,
  GoalUpdatePayload,
  GoalView,
  HabitHistoryView,
  HabitPayload,
  HabitView,
  MicroWinPayload,
  MicroWinView,
  MilestonePayload,
  MilestoneView,
  OneOffTaskPayload,
  RelapsePayload,
  RelapseResult,
  ReschedulePayload,
  TaskView,
} from '../accent.types';

/** API-сервис раздела «Акцент» (`/api/v1/accent/*`): настройки + пауза-режим (2.0.0). */
@Injectable({ providedIn: 'root' })
export class AccentApiService {
  private readonly _http = inject(HttpClient);

  /**
   * Снимок главного экрана одним запросом (2.11): «Сейчас», день, цели, «держусь», просрочка,
   * шаги онбординга. Задачи дня при этом материализуются — дашборд и есть вход в день.
   * @returns Снимок дашборда.
   */
  public getDashboard(): Observable<DashboardView> {
    return this._http.get<DashboardView>(`${API_PREFIX}/accent/dashboard`);
  }

  /**
   * Статистика раздела (2.9): постоянство и достижения. Запрос **лениво догоняет** выдачу
   * достижений и вехи «держусь» на бэке — поэтому после него в колокольчике может появиться
   * новая строка.
   */
  public getStats(): Observable<StatsView> {
    return this._http.get<StatsView>(`${API_PREFIX}/accent/stats`);
  }

  /** Настройки раздела (ленивое создание на бэке). */
  public getSettings(): Observable<AccentSettingsView> {
    return this._http.get<AccentSettingsView>(`${API_PREFIX}/accent/settings`);
  }

  /** Поставить раздел на паузу (заморозка серий/ролловера). */
  public pause(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/accent/pause`, {});
  }

  /** Снять паузу. */
  public resume(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/accent/resume`, {});
  }

  /** Список активных микро-побед (с `completedToday`); первый заход сеет стартовый набор. */
  public listMicroWins(): Observable<MicroWinView[]> {
    return this._http.get<MicroWinView[]>(`${API_PREFIX}/accent/micro-wins`);
  }

  /** Создать микро-победу. */
  public createMicroWin(payload: MicroWinPayload): Observable<MicroWinView> {
    return this._http.post<MicroWinView>(`${API_PREFIX}/accent/micro-wins`, payload);
  }

  /** Изменить микро-победу. */
  public updateMicroWin(id: string, payload: MicroWinPayload): Observable<MicroWinView> {
    return this._http.patch<MicroWinView>(`${API_PREFIX}/accent/micro-wins/${id}`, payload);
  }

  /** Удалить микро-победу. */
  public deleteMicroWin(id: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/accent/micro-wins/${id}`);
  }

  /** Отметить выполнение (идемпотентно по дню) — вернёт `completedToday=true`. */
  public completeMicroWin(id: string): Observable<MicroWinView> {
    return this._http.post<MicroWinView>(`${API_PREFIX}/accent/micro-wins/${id}/complete`, {});
  }

  /** Получить стартовый пак (докидывает примеры, своё не трогает) → свежий список. */
  public seedStarterPack(): Observable<MicroWinView[]> {
    return this._http.post<MicroWinView[]>(`${API_PREFIX}/accent/micro-wins/starter-pack`, {});
  }

  /** Очистить примеры (удаляет только не присвоенные стартовые) → свежий список. */
  public clearStarters(): Observable<MicroWinView[]> {
    return this._http.delete<MicroWinView[]>(`${API_PREFIX}/accent/micro-wins/starter-pack`);
  }

  // ── Справочники (сферы/атрибуты, read-only) ──

  /** Каталог сфер жизни. */
  public listDomains(): Observable<AccentRefItem[]> {
    return this._http.get<AccentRefItem[]>(`${API_PREFIX}/accent/domains`);
  }

  /** Каталог RPG-атрибутов. */
  public listAttributes(): Observable<AccentRefItem[]> {
    return this._http.get<AccentRefItem[]>(`${API_PREFIX}/accent/attributes`);
  }

  // ── Привычки (2.4) ──

  /** Список активных привычек. */
  public listHabits(): Observable<HabitView[]> {
    return this._http.get<HabitView[]>(`${API_PREFIX}/accent/habits`);
  }

  /** Одна привычка. */
  public getHabit(id: string): Observable<HabitView> {
    return this._http.get<HabitView>(`${API_PREFIX}/accent/habits/${id}`);
  }

  /** Создать привычку. */
  public createHabit(payload: HabitPayload): Observable<HabitView> {
    return this._http.post<HabitView>(`${API_PREFIX}/accent/habits`, payload);
  }

  /** Изменить привычку (частично). */
  public updateHabit(id: string, payload: Partial<HabitPayload>): Observable<HabitView> {
    return this._http.patch<HabitView>(`${API_PREFIX}/accent/habits/${id}`, payload);
  }

  /** Деактивировать привычку (мягко). */
  public deactivateHabit(id: string): Observable<HabitView> {
    return this._http.post<HabitView>(`${API_PREFIX}/accent/habits/${id}/deactivate`, {});
  }

  /** Получить стартовый пак привычек (докидывает примеры, своё не трогает) → свежий список. */
  public seedHabitStarterPack(): Observable<HabitView[]> {
    return this._http.post<HabitView[]>(`${API_PREFIX}/accent/habits/starter-pack`, {});
  }

  /** Очистить примеры привычек (удаляет только непринятые стартовые) → свежий список. */
  public clearHabitStarters(): Observable<HabitView[]> {
    return this._http.delete<HabitView[]>(`${API_PREFIX}/accent/habits/starter-pack`);
  }

  /** Присвоить пример себе («Добавить себе»): снимает флаг — привычка начнёт давать задачи. */
  public adoptHabit(id: string): Observable<HabitView> {
    return this._http.post<HabitView>(`${API_PREFIX}/accent/habits/${id}/adopt`, {});
  }

  // ── Задачи дня (2.4) ──

  /** Задачи дня (по умолчанию — сегодня); материализуются из привычек на бэке. */
  public listTasks(date?: string): Observable<TaskView[]> {
    const query = date === undefined ? '' : `?date=${date}`;
    return this._http.get<TaskView[]>(`${API_PREFIX}/accent/tasks${query}`);
  }

  /** Просроченные разовые задачи. */
  public listOverdueTasks(): Observable<TaskView[]> {
    return this._http.get<TaskView[]>(`${API_PREFIX}/accent/tasks/overdue`);
  }

  /** Разовые задачи с дедлайном сегодня. */
  public listDueTodayTasks(): Observable<TaskView[]> {
    return this._http.get<TaskView[]>(`${API_PREFIX}/accent/tasks/due-today`);
  }

  /** Создать разовую задачу. */
  public createOneOffTask(payload: OneOffTaskPayload): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks`, payload);
  }

  /**
   * Отметить выполнение (binary — без `doneValue`; quantitative/timed — со значением).
   * Возвращает задачу + событие лесенки (`ladderEvent`) для фидбэка адаптивности.
   * `replace` (2.7.1) — осознанная замена уже записанного результата **меньшим** значением
   * («Начать сначала» в таймере). Без флага понижение → `409 TASK_VALUE_DOWNGRADE`.
   */
  public completeTask(
    id: string,
    doneValue?: number,
    replace = false,
  ): Observable<CompleteTaskResult> {
    const body = {
      ...(doneValue === undefined ? {} : { doneValue }),
      ...(replace ? { replace: true } : {}),
    };
    return this._http.post<CompleteTaskResult>(`${API_PREFIX}/accent/tasks/${id}/complete`, body);
  }

  /** «Сделал минимум» (2.7·H): лог микро-победы + частичный зачёт задачи одной операцией. */
  public completeMinimumTask(id: string): Observable<CompleteMinimumResult> {
    return this._http.post<CompleteMinimumResult>(
      `${API_PREFIX}/accent/tasks/${id}/complete-minimum`,
      {},
    );
  }

  /** Снять отметку выполнения. */
  public uncompleteTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/uncomplete`, {});
  }

  /**
   * История привычки (2.7.3): что было по дням + «тишина». Keyset-пагинация — `before` берётся
   * из `nextCursor` предыдущей страницы. Эндпоинт только читает и ничего не создаёт.
   * @param id Идентификатор привычки.
   * @param before Курсор «Показать ещё» (опц.).
   * @returns Страница истории.
   */
  public getHabitHistory(id: string, before?: string): Observable<HabitHistoryView> {
    const query = before === undefined ? '' : `?before=${encodeURIComponent(before)}`;
    return this._http.get<HabitHistoryView>(`${API_PREFIX}/accent/habits/${id}/history${query}`);
  }

  /** Перенести задачу на завтра. */
  public postponeTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/postpone`, {});
  }

  /**
   * Вернуть перенесённую задачу на сегодня (2.7.2): задача снова в работе, завтрашняя копия
   * удаляется. Работает только для сегодняшнего переноса.
   */
  public unpostponeTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/unpostpone`, {});
  }

  // ─────────────────────────── Цели (2.5) ───────────────────────────

  /** Список целей (с вычисляемым прогрессом), опц. фильтр по статусу/сфере. */
  public listGoals(status?: GoalStatus, domain?: string): Observable<GoalProgressView[]> {
    const params = new URLSearchParams();
    if (status !== undefined) {
      params.set('status', status);
    }
    if (domain !== undefined && domain !== '') {
      params.set('domain', domain);
    }
    const query = params.toString();
    return this._http.get<GoalProgressView[]>(
      `${API_PREFIX}/accent/goals${query ? `?${query}` : ''}`,
    );
  }

  /** Одна цель с прогрессом. */
  public getGoal(id: string): Observable<GoalProgressView> {
    return this._http.get<GoalProgressView>(`${API_PREFIX}/accent/goals/${id}`);
  }

  /** Прямые подцели цели (с прогрессом). */
  public listChildGoals(id: string): Observable<GoalProgressView[]> {
    return this._http.get<GoalProgressView[]>(`${API_PREFIX}/accent/goals/${id}/children`);
  }

  /** Получить стартовый пак целей (докидывает примеры) → свежий список. */
  public seedGoalStarterPack(): Observable<GoalProgressView[]> {
    return this._http.post<GoalProgressView[]>(`${API_PREFIX}/accent/goals/starter-pack`, {});
  }

  /** Очистить примеры целей (непринятые) → свежий список. */
  public clearGoalStarters(): Observable<GoalProgressView[]> {
    return this._http.delete<GoalProgressView[]>(`${API_PREFIX}/accent/goals/starter-pack`);
  }

  /** Присвоить пример себе («Добавить себе»). */
  public adoptGoal(id: string): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals/${id}/adopt`, {});
  }

  /** Поставить цель в фокус (ADR-0053) — возвращает мету для мягкого предупреждения. */
  public focusGoal(id: string): Observable<GoalFocusResult> {
    return this._http.post<GoalFocusResult>(`${API_PREFIX}/accent/goals/${id}/focus`, {});
  }

  /** Убрать цель из фокуса (ADR-0053). */
  public unfocusGoal(id: string): Observable<GoalFocusResult> {
    return this._http.delete<GoalFocusResult>(`${API_PREFIX}/accent/goals/${id}/focus`);
  }

  /** Переставить цели в заданный порядок (drag-reorder, ADR-0054). */
  public reorderGoals(ids: readonly string[]): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/accent/goals/reorder`, { ids });
  }

  /** Переставить ранг фокусных целей (drag внутри «В фокусе», ADR-0053/0054). */
  public reorderGoalFocus(ids: readonly string[]): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/accent/goals/focus-reorder`, { ids });
  }

  /** Переставить микро-победы (drag-reorder, ADR-0054). */
  public reorderMicroWins(ids: readonly string[]): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/accent/micro-wins/reorder`, { ids });
  }

  /** Переставить привычки (drag-reorder → priority, ADR-0054). */
  public reorderHabits(ids: readonly string[]): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/accent/habits/reorder`, { ids });
  }

  /** Создать цель. */
  public createGoal(payload: GoalPayload): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals`, payload);
  }

  /** Обновить цель (частично; род/база/родитель иммутабельны). */
  public updateGoal(id: string, payload: GoalUpdatePayload): Observable<GoalView> {
    return this._http.patch<GoalView>(`${API_PREFIX}/accent/goals/${id}`, payload);
  }

  /** Архивировать цель. */
  public archiveGoal(id: string): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals/${id}/archive`, {});
  }

  /** Восстановить цель из архива. */
  public restoreGoal(id: string): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals/${id}/restore`, {});
  }

  /** Вернуть завершённую цель в работу (completed → active). */
  public reopenGoal(id: string): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals/${id}/reopen`, {});
  }

  /** Поставить цель на паузу. */
  public pauseGoal(id: string): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals/${id}/pause`, {});
  }

  /** Снять цель с паузы. */
  public resumeGoal(id: string): Observable<GoalView> {
    return this._http.post<GoalView>(`${API_PREFIX}/accent/goals/${id}/resume`, {});
  }

  /** Добавить запись прогресса (возвращает запись + цель с пересчётом). */
  public addGoalEntry(id: string, payload: GoalEntryPayload): Observable<AddGoalEntryResult> {
    return this._http.post<AddGoalEntryResult>(
      `${API_PREFIX}/accent/goals/${id}/entries`,
      payload,
    );
  }

  /** Удалить запись прогресса (ручная коррекция, патч 8). */
  public removeGoalEntry(goalId: string, entryId: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/accent/goals/${goalId}/entries/${entryId}`);
  }

  /** Правка записи прогресса (патч 8). */
  public updateGoalEntry(
    goalId: string,
    entryId: string,
    payload: { value?: number; occurredOn?: string; note?: string | null },
  ): Observable<GoalEntryView> {
    return this._http.patch<GoalEntryView>(
      `${API_PREFIX}/accent/goals/${goalId}/entries/${entryId}`,
      payload,
    );
  }

  /** История записей прогресса (курсор по `id`, новые сверху). */
  public listGoalEntries(
    id: string,
    cursor?: string,
    limit?: number,
  ): Observable<GoalEntryView[]> {
    const params = new URLSearchParams();
    if (cursor !== undefined) {
      params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    const query = params.toString();
    return this._http.get<GoalEntryView[]>(
      `${API_PREFIX}/accent/goals/${id}/entries${query ? `?${query}` : ''}`,
    );
  }

  /** Вехи цели (с вычисленным `reached`). */
  public listMilestones(id: string): Observable<MilestoneView[]> {
    return this._http.get<MilestoneView[]>(`${API_PREFIX}/accent/goals/${id}/milestones`);
  }

  /** Добавить веху. */
  public addMilestone(id: string, payload: MilestonePayload): Observable<MilestoneView> {
    return this._http.post<MilestoneView>(
      `${API_PREFIX}/accent/goals/${id}/milestones`,
      payload,
    );
  }

  /** Удалить веху (только не достигнутую). */
  public removeMilestone(goalId: string, milestoneId: string): Observable<void> {
    return this._http.delete<void>(
      `${API_PREFIX}/accent/goals/${goalId}/milestones/${milestoneId}`,
    );
  }

  // ─────────────────────────── Держусь / анти-привычки (2.6) ───────────────────────────

  /** Список активных анти-привычек «держусь». */
  public listAntiHabits(): Observable<AntiHabitView[]> {
    return this._http.get<AntiHabitView[]>(`${API_PREFIX}/accent/anti-habits`);
  }

  /** Одна анти-привычка. */
  public getAntiHabit(id: string): Observable<AntiHabitView> {
    return this._http.get<AntiHabitView>(`${API_PREFIX}/accent/anti-habits/${id}`);
  }

  /** Создать анти-привычку (первая попытка стартует сейчас). */
  public createAntiHabit(payload: AntiHabitPayload): Observable<AntiHabitView> {
    return this._http.post<AntiHabitView>(`${API_PREFIX}/accent/anti-habits`, payload);
  }

  /** Изменить анти-привычку (частично; `isActive:false` = убрать из списка). */
  public updateAntiHabit(id: string, payload: AntiHabitUpdatePayload): Observable<AntiHabitView> {
    return this._http.patch<AntiHabitView>(`${API_PREFIX}/accent/anti-habits/${id}`, payload);
  }

  /** Зафиксировать срыв (сброс таймера, обновление рекорда, запись события `relapse`). */
  public relapseAntiHabit(id: string, payload: RelapsePayload): Observable<RelapseResult> {
    return this._http.post<RelapseResult>(
      `${API_PREFIX}/accent/anti-habits/${id}/relapse`,
      payload,
    );
  }

  /** Перенести старт в будущее (ADR-0059): завершает текущую попытку, старт → planned. */
  public rescheduleAntiHabit(id: string, payload: ReschedulePayload): Observable<RelapseResult> {
    return this._http.post<RelapseResult>(
      `${API_PREFIX}/accent/anti-habits/${id}/reschedule`,
      payload,
    );
  }

  /** Переставить анти-привычки в заданный порядок (drag-reorder → position, ADR-0054). */
  public reorderAntiHabits(ids: readonly string[]): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/accent/anti-habits/reorder`, { ids });
  }

  /** История событий (cursor-пагинация `{ items, nextCursor }`, новые→старые). */
  public listAntiHabitEvents(
    id: string,
    cursor?: string,
    limit?: number,
  ): Observable<AntiHabitEventPage> {
    const params = new URLSearchParams();
    if (cursor !== undefined) {
      params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    const query = params.toString();
    return this._http.get<AntiHabitEventPage>(
      `${API_PREFIX}/accent/anti-habits/${id}/events${query ? `?${query}` : ''}`,
    );
  }

  /** Получить стартовый пак «держусь» (идемпотентно докидывает примеры, ADR-0051). */
  public seedAntiHabitStarterPack(): Observable<AntiHabitView[]> {
    return this._http.post<AntiHabitView[]>(`${API_PREFIX}/accent/anti-habits/starter-pack`, {});
  }

  /** Очистить примеры «держусь» (удаляет только непринятые, ADR-0051). */
  public clearAntiHabitStarters(): Observable<AntiHabitView[]> {
    return this._http.delete<AntiHabitView[]>(`${API_PREFIX}/accent/anti-habits/starter-pack`);
  }

  /** Присвоить пример себе («Добавить себе», ADR-0051): снимает флаг, стартует серию. */
  public adoptAntiHabit(id: string): Observable<AntiHabitView> {
    return this._http.post<AntiHabitView>(`${API_PREFIX}/accent/anti-habits/${id}/adopt`, {});
  }

  // ─────────────────────────── Препятствия (2.7, ADR-0062) ───────────────────────────

  /** Список препятствий + флаг мягкого порога (подсказка «может, часть в архив?»). */
  public listObstacles(): Observable<ObstacleListView> {
    return this._http.get<ObstacleListView>(`${API_PREFIX}/accent/obstacles`);
  }

  /** Одно препятствие. */
  public getObstacle(id: string): Observable<ObstacleView> {
    return this._http.get<ObstacleView>(`${API_PREFIX}/accent/obstacles/${id}`);
  }

  /** Создать препятствие. */
  public createObstacle(payload: ObstaclePayload): Observable<ObstacleView> {
    return this._http.post<ObstacleView>(`${API_PREFIX}/accent/obstacles`, payload);
  }

  /** Изменить препятствие (`isActive:false` — убрать из списка; правка примера присваивает его). */
  public updateObstacle(id: string, payload: ObstacleUpdatePayload): Observable<ObstacleView> {
    return this._http.patch<ObstacleView>(`${API_PREFIX}/accent/obstacles/${id}`, payload);
  }

  /** Удалить препятствие (контрмеры и журнал уходят каскадом). */
  public deleteObstacle(id: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/accent/obstacles/${id}`);
  }

  /** Получить примеры препятствий (идемпотентно докидывает недостающие). */
  public seedObstacleStarterPack(): Observable<ObstacleListView> {
    return this._http.post<ObstacleListView>(`${API_PREFIX}/accent/obstacles/starter-pack`, {});
  }

  /** Очистить непринятые примеры (присвоенные остаются). */
  public clearObstacleStarters(): Observable<ObstacleListView> {
    return this._http.delete<ObstacleListView>(`${API_PREFIX}/accent/obstacles/starter-pack`);
  }

  /** «Добавить себе»: пример становится обычным препятствием со своими ответами. */
  public adoptObstacle(id: string): Observable<ObstacleView> {
    return this._http.post<ObstacleView>(`${API_PREFIX}/accent/obstacles/${id}/adopt`, {});
  }

  /** Ручной порядок препятствий (drag). */
  public reorderObstacles(ids: readonly string[]): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/accent/obstacles/reorder`, { ids });
  }

  /** Контрмеры препятствия (в ручном порядке, с «помогало N из M»). */
  public listCounterplays(obstacleId: string): Observable<CounterplayView[]> {
    return this._http.get<CounterplayView[]>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/counterplays`,
    );
  }

  /** Добавить контрмеру. */
  public createCounterplay(
    obstacleId: string,
    payload: CounterplayPayload,
  ): Observable<CounterplayView> {
    return this._http.post<CounterplayView>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/counterplays`,
      payload,
    );
  }

  /** Изменить контрмеру (`linkedMicroWinId: null` — снять привязку). */
  public updateCounterplay(
    obstacleId: string,
    counterplayId: string,
    payload: CounterplayUpdatePayload,
  ): Observable<CounterplayView> {
    return this._http.patch<CounterplayView>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/counterplays/${counterplayId}`,
      payload,
    );
  }

  /** Удалить контрмеру (записи журнала остаются, теряется лишь «чем ответил»). */
  public deleteCounterplay(obstacleId: string, counterplayId: string): Observable<void> {
    return this._http.delete<void>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/counterplays/${counterplayId}`,
    );
  }

  /** Ручной порядок контрмер внутри препятствия. */
  public reorderCounterplays(obstacleId: string, ids: readonly string[]): Observable<void> {
    return this._http.put<void>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/counterplays/reorder`,
      { ids },
    );
  }

  /** «Столкнулся» — записать столкновение; ответ несёт свежую карточку со счётчиками. */
  public recordEncounter(
    obstacleId: string,
    payload: EncounterPayload,
  ): Observable<EncounterRecordResult> {
    return this._http.post<EncounterRecordResult>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/encounters`,
      payload,
    );
  }

  /** Лента столкновений (keyset-пагинация, новые→старые). */
  public listEncounters(
    obstacleId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Observable<ObstacleEncounterPage> {
    let params = new HttpParams();
    if (opts.limit !== undefined) {
      params = params.set('limit', String(opts.limit));
    }
    if (opts.cursor !== undefined && opts.cursor !== '') {
      params = params.set('cursor', opts.cursor);
    }
    return this._http.get<ObstacleEncounterPage>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/encounters`,
      { params },
    );
  }

  /** Проставить исход столкновения позже («Помогло?» в ленте). Отвечать необязательно. */
  public setEncounterOutcome(
    obstacleId: string,
    encounterId: string,
    outcome: 'helped' | 'partly' | 'no',
  ): Observable<ObstacleEncounterView> {
    return this._http.patch<ObstacleEncounterView>(
      `${API_PREFIX}/accent/obstacles/${obstacleId}/encounters/${encounterId}`,
      { outcome },
    );
  }
}
