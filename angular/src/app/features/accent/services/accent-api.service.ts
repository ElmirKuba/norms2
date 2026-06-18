import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type {
  AccentRefItem,
  AccentSettingsView,
  HabitPayload,
  HabitView,
  MicroWinPayload,
  MicroWinView,
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

  /** Отметить выполнение (binary — без `doneValue`; quantitative/timed — со значением). */
  public completeTask(id: string, doneValue?: number): Observable<TaskView> {
    const body = doneValue === undefined ? {} : { doneValue };
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/complete`, body);
  }

  /** Снять отметку выполнения. */
  public uncompleteTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/uncomplete`, {});
  }

  /** Перенести задачу на завтра. */
  public postponeTask(id: string): Observable<TaskView> {
    return this._http.post<TaskView>(`${API_PREFIX}/accent/tasks/${id}/postpone`, {});
  }
}
