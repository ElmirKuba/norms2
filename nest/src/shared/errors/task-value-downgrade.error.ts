import { DomainError } from './domain.error';

/**
 * Попытка понизить уже записанный результат задачи без явного намерения → HTTP 409, машинный код
 * `TASK_VALUE_DOWNGRADE` (2.7.1).
 *
 * Зачем: вкладка с устаревшими данными (отметил с телефона — на десктопе висит старое) молча
 * перезаписывала результат, и «100 приседаний» превращались в «60». Легальное понижение ровно
 * одно — «Начать сначала» в таймере, оно шлёт `replace: true`.
 */
export class TaskValueDowngradeError extends DomainError {
  /** Машинный код. */
  public readonly code = 'TASK_VALUE_DOWNGRADE';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}
