import { HttpErrorResponse } from '@angular/common/http';

/** RU-сообщения по машинному `error.code` бэка (конверт `{error:{code,message}}`). */
const MESSAGES: Readonly<Record<string, string>> = {
  BAD_CREDENTIALS: 'Неверный логин или пароль.',
  LOGIN_TAKEN: 'Этот логин уже занят.',
  INVITE_REQUIRED: 'Нужен код приглашения.',
  INVITE_INVALID: 'Код приглашения недействителен или истёк.',
  QUOTA_EXCEEDED: 'Исчерпана квота приглашений.',
  ACCOUNT_DEACTIVATED: 'Аккаунт деактивирован.',
  ACCOUNT_BANNED: 'Доступ заблокирован.',
  ACCOUNT_NOT_FOUND: 'Не найдено.',
  RECOVERY_FAILED: 'Восстановление не удалось — проверьте ответы.',
  RECOVERY_NOT_AVAILABLE: 'Для этого аккаунта восстановление недоступно.',
  RECOVERY_REQUIRED_COUNT_INVALID: 'Некорректное число вопросов.',
  SECRET_QA_NOT_FOUND: 'Вопрос не найден.',
  SESSION_NOT_FOUND: 'Сессия не найдена.',
  BAN_FORBIDDEN: 'Это действие недоступно.',
  BAN_NOT_FOUND: 'Бан не найден.',
  AVATAR_INVALID: 'Неподходящий файл — нужен JPEG, PNG или WEBP в пределах лимита.',
  VALIDATION_ERROR: 'Проверьте правильность заполнения.',
  MICRO_WIN_NOT_FOUND: 'Микро-победа не найдена.',
};

/** Безопасно извлекает конверт ошибки бэка. */
function envelope(error: unknown): { code?: string; message?: string } | null {
  if (error instanceof HttpErrorResponse && error.error !== null && typeof error.error === 'object') {
    const body = error.error as { error?: { code?: string; message?: string } };
    return body.error ?? null;
  }
  return null;
}

/**
 * Машинный код ошибки (`error.code`) или null — для ветвления (deactivated/banned).
 * @param error Ошибка (обычно HttpErrorResponse).
 * @returns Код или null.
 */
export function errorCode(error: unknown): string | null {
  return envelope(error)?.code ?? null;
}

/**
 * Человекочитаемое сообщение по ошибке: по коду → словарь, иначе серверное
 * сообщение, иначе fallback.
 * @param error Ошибка.
 * @param fallback Запасной текст.
 * @returns Сообщение для пользователя.
 */
export function errorMessage(error: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз.'): string {
  const env = envelope(error);
  // VALIDATION_ERROR несёт КОНКРЕТНОЕ пользовательское сообщение от бэка (RU, готовое к показу:
  // «впиши ради чего откажусь», «цель должна быть больше 0» и т.п.) — показываем его, а не
  // generic из словаря (иначе mission-filter и прочие валидации теряют смысл). Generic — фолбэк.
  if (env?.code === 'VALIDATION_ERROR' && env.message !== undefined && env.message.trim() !== '') {
    return env.message;
  }
  if (env?.code !== undefined) {
    const mapped = MESSAGES[env.code];
    if (mapped !== undefined) {
      return mapped;
    }
  }
  return env?.message ?? fallback;
}
