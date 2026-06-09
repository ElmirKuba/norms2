import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { SecretQaView } from '../recovery-settings.types';

/**
 * API-сервис настроек восстановления (`/api/v1/recovery/*`, под Guard): секретные
 * вопросы (список/добавить/удалить) и K (сколько вопросов спрашивать при
 * восстановлении). Ответы наружу не уходят — только тексты вопросов.
 */
@Injectable({ providedIn: 'root' })
export class RecoverySettingsApiService {
  private readonly _http = inject(HttpClient);

  /** Мои секретные вопросы (без ответов). */
  public listQuestions(): Observable<SecretQaView[]> {
    return this._http.get<SecretQaView[]>(`${API_PREFIX}/recovery/questions`);
  }

  /** Добавить вопрос+ответ → созданный вопрос (без ответа). */
  public addQuestion(question: string, answer: string): Observable<SecretQaView> {
    return this._http.post<SecretQaView>(`${API_PREFIX}/recovery/questions`, { question, answer });
  }

  /** Удалить вопрос по id. */
  public removeQuestion(id: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/recovery/questions/${encodeURIComponent(id)}`);
  }

  /** Установить K (сколько вопросов спрашивать; 1 ≤ K ≤ N). */
  public setRequiredCount(requiredCount: number): Observable<void> {
    return this._http.put<void>(`${API_PREFIX}/recovery/required-count`, { requiredCount });
  }
}
