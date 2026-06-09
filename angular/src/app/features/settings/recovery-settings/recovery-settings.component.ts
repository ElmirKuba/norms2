import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { RecoverySettingsApiService } from '../services/recovery-settings-api.service';
import { AuthApiService } from '../../auth/services/auth-api.service';
import { AuthStore } from '../../../core/auth/auth-store.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { TextFieldComponent } from '../../../shared/ui/text-field/text-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { SecretQaView } from '../recovery-settings.types';

/**
 * Настройки восстановления доступа (вкладка «Безопасность»): секретные вопросы
 * (список/добавить/удалить) + **K** (сколько из N спрашивать при восстановлении).
 * Ответы наружу не уходят (хеш на бэке). Текущий K — из `AuthStore` (поле
 * `recoveryRequiredCount`); после изменений освежаем `me()`. Баннер-напоминание,
 * пока восстановление не настроено (нет вопросов или K не задан).
 */
@Component({
  selector: 'app-recovery-settings',
  imports: [TextFieldComponent, ButtonComponent, BannerComponent, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recovery-settings.component.html',
  styleUrl: './recovery-settings.component.scss',
})
export class RecoverySettingsComponent {
  private readonly _api = inject(RecoverySettingsApiService);
  private readonly _authApi = inject(AuthApiService);
  private readonly _authStore = inject(AuthStore);
  private readonly _modal = inject(ModalService);

  /** Мои секретные вопросы. */
  protected readonly questions = signal<SecretQaView[]>([]);
  /** Идёт первичная загрузка. */
  protected readonly loading = signal(true);
  /** Идёт добавление вопроса. */
  protected readonly adding = signal(false);
  /** Ошибка добавления. */
  protected readonly formError = signal<string | null>(null);
  /** Идёт сохранение K. */
  protected readonly countSaving = signal(false);

  /** Контролы нового вопроса (зеркало бэка: 1–300). */
  protected readonly questionControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });
  protected readonly answerControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });

  /** Текущее K (из аккаунта) или null. */
  protected readonly requiredCount = computed(() => this._authStore.account()?.recoveryRequiredCount ?? null);
  /** Варианты K: 1..N. */
  protected readonly countOptions = computed(() =>
    Array.from({ length: this.questions().length }, (_, index) => index + 1),
  );
  /** Настроено ли восстановление (есть вопросы и задан K). */
  protected readonly configured = computed(() => this.questions().length > 0 && this.requiredCount() !== null);

  public constructor() {
    this._api.listQuestions().subscribe({
      next: (questions) => {
        this.questions.set(questions);
        this.loading.set(false);
      },
      error: () => {
        this.questions.set([]);
        this.loading.set(false);
      },
    });
  }

  /** Добавляет секретный вопрос. */
  protected addQuestion(): void {
    if (this.questionControl.invalid || this.answerControl.invalid) {
      this.questionControl.markAsTouched();
      this.answerControl.markAsTouched();
      this.formError.set('Заполните вопрос и ответ (до 300 символов).');
      return;
    }
    this.adding.set(true);
    this.formError.set(null);
    this._api.addQuestion(this.questionControl.getRawValue(), this.answerControl.getRawValue()).subscribe({
      next: (question) => {
        this.questions.update((list) => [...list, question]);
        this.questionControl.reset('');
        this.answerControl.reset('');
        this.adding.set(false);
      },
      error: (error: unknown) => {
        this.formError.set(errorMessage(error));
        this.adding.set(false);
      },
    });
  }

  /** Удаляет вопрос (с подтверждением). */
  protected async removeQuestion(question: SecretQaView): Promise<void> {
    const confirmed = await this._modal.confirm({
      title: 'Удалить вопрос?',
      text: 'Если вопросов станет меньше K, восстановление может стать недоступным.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this._api.removeQuestion(question.id).subscribe({
      next: () => {
        this.questions.update((list) => list.filter((q) => q.id !== question.id));
        this._refreshAccount();
      },
      error: (error: unknown) => this._modal.error('Не удалось удалить', errorMessage(error)),
    });
  }

  /** Обработчик смены значения в select. */
  protected onCountChange(event: Event): void {
    this.setCount((event.target as HTMLSelectElement).value);
  }

  /** Устанавливает K (сколько вопросов спрашивать). */
  private setCount(value: string): void {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) {
      return;
    }
    this.countSaving.set(true);
    this._api.setRequiredCount(count).subscribe({
      next: () => {
        this._refreshAccount();
        this.countSaving.set(false);
      },
      error: (error: unknown) => {
        this._modal.error('Не удалось сохранить', errorMessage(error));
        this.countSaving.set(false);
      },
    });
  }

  /** Освежает аккаунт в сторе (K мог измениться). */
  private _refreshAccount(): void {
    this._authApi.me().subscribe({
      next: (account) => this._authStore.setAccount(account),
      error: () => {
        /* не критично — обновится при следующей загрузке профиля */
      },
    });
  }
}
