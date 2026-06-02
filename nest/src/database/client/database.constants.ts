import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** DI-токен для инстанса Drizzle (доступ к БД из репозиториев). */
export const DRIZZLE = Symbol('DRIZZLE');

/**
 * Тип инстанса Drizzle для PostgreSQL (node-postgres). Дженерик схемы пока
 * пустой — таблицы появятся на этапе S1 (src/system/orm-schemas).
 */
export type DrizzleDatabase = NodePgDatabase<Record<string, never>>;
