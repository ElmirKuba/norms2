import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type {
  AccentRefItem,
  AccentSettingsView,
  AddGoalEntryResult,
  CompleteTaskResult,
  GoalEntryPayload,
  GoalEntryView,
  GoalFocusResult,
  GoalPayload,
  GoalProgressView,
  GoalStatus,
  GoalUpdatePayload,
  GoalView,
  HabitPayload,
  HabitView,
  MicroWinPayload,
  MicroWinView,
  MilestonePayload,
  MilestoneView,
  OneOffTaskPayload,
  TaskView,
} from '../accent.types';

/** API-сервис раздела «Акцент» (`/api/v1/accent/*`): настройки + пауза-режим (2.0.0). */
@Injectable({ providedIn: 'root' })
export class AccentApiService {
  private readonly _http = inject(HttpClient);

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
   */
  public completeTask(id: string, doneValue?: number): Observable<CompleteTaskResult> {
    const body = doneValue === undefined ? {} : { doneValue };
    return this._http.post<CompleteTaskResult>(`${API_PREFIX}/accent/tasks/${id}/complete`, body);
  }

  /** Снять отметку выполнения. */
  public uncompleteTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/uncomplete`, {});
  }

  /** Перенести задачу на завтра. */
  public postponeTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/postpone`, {});
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
}
