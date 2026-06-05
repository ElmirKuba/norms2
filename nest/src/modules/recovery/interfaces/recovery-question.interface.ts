import type { SecretQaFull } from './secret-qa-full.interface';

/**
 * RecoveryQuestion — вопрос-челлендж, выдаваемый при восстановлении (K случайных
 * по логину). Только `id`+`question`; ответ пользователь присылает в complete.
 */
export type RecoveryQuestion = Pick<SecretQaFull, 'id' | 'question'>;
