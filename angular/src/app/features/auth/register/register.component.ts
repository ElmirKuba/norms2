import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { TelegramPublicApiService } from '../services/telegram-public-api.service';
import { AuthApiService } from '../services/auth-api.service';
import { FeatureFlagsStore } from '../../../core/feature-flags/feature-flags-store.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { TextFieldComponent } from '../../../shared/ui/text-field/text-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';

/** Состояние проверки кода приглашения. */
type CodeState = 'idle' | 'checking' | 'valid' | 'invalid';

/** Имена полей формы (для маппинга ошибок). */
type FieldName = 'login' | 'alias' | 'password';

/** Сообщения валидации (зеркало бэка; сервер — источник истины). */
const FIELD_MESSAGES: Readonly<Record<FieldName, Readonly<Record<string, string>>>> = {
  login: { required: 'Введите логин.', pattern: 'Логин: 3–32 символа (буквы, цифры, _).' },
  alias: { required: 'Введите псевдоним.', minlength: 'Псевдоним: минимум 3.', maxlength: 'Псевдоним: максимум 32.' },
  password: { required: 'Введите пароль.', minlength: 'Пароль: минимум 3.', maxlength: 'Пароль: максимум 64.' },
};

/**
 * Экран регистрации. В invite-режиме (`freeRegistration=false`) сперва шаг ввода
 * кода: авто-проверка `POST /invites/check` без кнопки → при валидном пускает к
 * форме. Форма (alias/login/password, password show/hide, зеркало-валидация) →
 * `POST /auth/register` → редирект на /login (токенов нет, ADR-0010).
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TextFieldComponent, ButtonComponent, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly _api = inject(AuthApiService);
  private readonly _telegramPublicApi = inject(TelegramPublicApiService);
  private readonly _flags = inject(FeatureFlagsStore);
  private readonly _modal = inject(ModalService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  /** Текущий шаг. */
  /**
   * Ссылка на бота для тех, у кого кода нет.
   *
   * Грузится молча и без блокировки: не ответила — на экране просто не будет строки про заявку,
   * а регистрация по коду работает как работала.
   */
  protected readonly botUrl = signal<string | null>(null);

  protected readonly step = signal<'code' | 'form'>(this._flags.flags().freeRegistration ? 'form' : 'code');
  /** Состояние проверки кода. */
  protected readonly codeState = signal<CodeState>('idle');
  /** Принятый (валидный) нормализованный код. */
  protected readonly acceptedCode = signal<string | null>(null);
  /** Идёт отправка регистрации. */
  protected readonly submitting = signal(false);
  /** Ошибка уровня формы (от сервера). */
  protected readonly formError = signal<string | null>(null);

  /** Контрол ввода кода. */
  protected readonly codeControl = new FormControl('', { nonNullable: true });

  /** Форма регистрации (валидаторы — зеркало бэка). */
  protected readonly form = new FormGroup({
    login: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-zA-Z0-9_]{3,32}$/)],
    }),
    alias: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(32)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(64)],
    }),
  });

  public constructor() {
    // Авто-проверка кода: нормализуем, при 10 символах дёргаем /invites/check.
    this.codeControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((raw) => {
      this._onCodeChange(raw);
    });
    // Приход со страницы-поздравления `/invite?code=…`: подставляем код → авто-проверка сама
    // пустит к форме (в invite-режиме шаг «код» пропускается, если код валиден).
    const code = this._route.snapshot.queryParamMap.get('code');
    if (code !== null && code !== '') {
      this.codeControl.setValue(code);
    }
    // Ссылка на бота — для тех, у кого кода нет. Ошибку глушим: без строки про заявку экран
    // работает, а с падающим запросом на публичной странице — нет.
    this._telegramPublicApi.view().subscribe({
      next: (view) => this.botUrl.set(view.botUrl === '' ? null : view.botUrl),
      error: () => this.botUrl.set(null),
    });
  }

  /** Текст ошибки поля (только после касания и при невалидности). */
  protected errorFor(control: FormControl<string>, name: FieldName): string | null {
    if (!control.touched || control.valid) {
      return null;
    }
    const errors = control.errors ?? {};
    const messages = FIELD_MESSAGES[name];
    for (const key of Object.keys(errors)) {
      const message = messages[key];
      if (message !== undefined) {
        return message;
      }
    }
    return 'Неверное значение.';
  }

  /** Отправляет регистрацию. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    const { login, alias, password } = this.form.getRawValue();
    const code = this.acceptedCode();
    const input = { login, alias, password, ...(code === null ? {} : { inviteCode: code }) };

    this._api.register(input).subscribe({
      next: () => {
        this._modal.success('Аккаунт создан', 'Теперь можно войти.');
        void this._router.navigate(['/login']);
      },
      error: (error: unknown) => {
        this.formError.set(errorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  /** Нормализует код и при полной длине проверяет его на сервере. */
  private _onCodeChange(raw: string): void {
    const code = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code.length < 10) {
      this.codeState.set('idle');
      return;
    }
    this.codeState.set('checking');
    this._api.checkInvite(code).subscribe({
      next: (response) => {
        if (response.valid) {
          this.acceptedCode.set(code);
          this.codeState.set('valid');
          this.step.set('form');
        } else {
          this.codeState.set('invalid');
        }
      },
      error: () => {
        this.codeState.set('invalid');
      },
    });
  }
}
