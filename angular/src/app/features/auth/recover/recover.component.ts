import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { TextFieldComponent } from '../../../shared/ui/text-field/text-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import type { RecoveryQuestion } from '../auth.types';

/**
 * Восстановление пароля (многошаговое, ADR-0008): шаг 1 — логин → `POST
 * /recovery/start` (K случайных вопросов); шаг 2 — ответы + новый пароль → `POST
 * /recovery/complete` → редирект на /login. Все провалы — единый `RECOVERY_FAILED`
 * (анти-энумерация), недоступность — `RECOVERY_NOT_AVAILABLE`.
 */
@Component({
  selector: 'app-recover',
  imports: [ReactiveFormsModule, RouterLink, TextFieldComponent, ButtonComponent, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recover.component.html',
  styleUrl: './recover.component.scss',
})
export class RecoverComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _modal = inject(ModalService);
  private readonly _router = inject(Router);

  /** Текущий шаг. */
  protected readonly step = signal<'login' | 'answer'>('login');
  /** Вопросы-челленджи (после start). */
  protected readonly questions = signal<RecoveryQuestion[]>([]);
  /** Идёт запрос. */
  protected readonly busy = signal(false);
  /** Ошибка шага. */
  protected readonly stepError = signal<string | null>(null);

  /** Логин (шаг 1). */
  protected readonly loginControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  /** Форма шага 2: ответы (по числу вопросов) + новый пароль. */
  protected readonly answerForm = new FormGroup({
    answers: new FormArray<FormControl<string>>([]),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(64)],
    }),
  });

  /** FormArray ответов (для шаблона). */
  protected get answersArray(): FormArray<FormControl<string>> {
    return this.answerForm.controls.answers;
  }

  /** Шаг 1: запросить вопросы по логину. */
  protected requestQuestions(): void {
    if (this.loginControl.invalid) {
      this.loginControl.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.stepError.set(null);
    this._api.recoveryStart(this.loginControl.value).subscribe({
      next: (response) => {
        this._setQuestions(response.questions);
        this.step.set('answer');
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.stepError.set(errorMessage(error));
        this.busy.set(false);
      },
    });
  }

  /** Шаг 2: сверить ответы и сменить пароль. */
  protected complete(): void {
    if (this.answerForm.invalid) {
      this.answerForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.stepError.set(null);
    const answers = this.questions().map((question, index) => ({
      questionId: question.id,
      answer: this.answersArray.at(index).value,
    }));

    this._api
      .recoveryComplete({
        login: this.loginControl.value,
        answers,
        newPassword: this.answerForm.controls.newPassword.value,
      })
      .subscribe({
        next: () => {
          this._modal.success('Пароль изменён', 'Войдите с новым паролем.');
          void this._router.navigate(['/login']);
        },
        error: (error: unknown) => {
          this.stepError.set(errorMessage(error));
          this.busy.set(false);
        },
      });
  }

  /** Перестраивает FormArray под полученные вопросы. */
  private _setQuestions(questions: RecoveryQuestion[]): void {
    this.questions.set(questions);
    this.answersArray.clear();
    for (const _question of questions) {
      this.answersArray.push(new FormControl('', { nonNullable: true, validators: [Validators.required] }));
    }
  }
}
