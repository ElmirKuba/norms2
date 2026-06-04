import type { AccountRead } from '../../account/interfaces/account-read.interface';

/**
 * RegisterResponse — ответ POST /auth/register: минимум об аккаунте, без токенов
 * (ADR-0010 — после регистрации редирект на вход). Производное из AccountRead.
 */
export type RegisterResponse = Pick<AccountRead, 'id' | 'login' | 'alias'>;
