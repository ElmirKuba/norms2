import type { SecretQaFull } from './secret-qa-full.interface';

/**
 * SecretQaView — проекция вопроса наружу (листинг «мои вопросы»). Никогда не
 * содержит `answerHash` (секрет не покидает бэк).
 */
export type SecretQaView = Pick<SecretQaFull, 'id' | 'question'>;
