import { z } from 'zod';
import { habitBodyShape } from './create-habit.dto';

/**
 * Схема тела PATCH /accent/habits/:id (closed-shape, все поля опциональны). `isActive`
 * не здесь — деактивация отдельным эндпоинтом. Счётчики лесенки сохраняет domain-service.
 */
export const updateHabitSchema = z.object(habitBodyShape).partial().strict();

/** Тип тела обновления привычки. */
export type UpdateHabitDto = z.infer<typeof updateHabitSchema>;
