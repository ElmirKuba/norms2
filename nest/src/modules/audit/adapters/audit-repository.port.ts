import type { AuditEntryBase } from '../interfaces/audit-entry-base.interface';
import type { AuditEntryFull } from '../interfaces/audit-entry-full.interface';

/** DI-токен порта репозитория журнала (биндится на реализацию в audit.module). */
export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

/**
 * Порт журнала действий администратора (2.9.3·6) — контракт «что домену нужно от хранилища»,
 * БЕЗ ORM.
 *
 * **Здесь нет ни `update`, ни `delete`, и это не забывчивость.** Журнал, который умеет менять и
 * удалять свои записи, доказывает ровно ничего. Отсутствие методов делает это свойством
 * архитектуры, а не договорённостью: чтобы подчистить след, придётся идти в базу руками — то
 * есть совершить заметное, осознанное действие.
 */
export interface AuditRepositoryPort {
  /**
   * Дописывает запись в журнал.
   * @param entry Содержательные поля записи.
   * @returns Сохранённая строка.
   */
  append(entry: AuditEntryBase): Promise<AuditEntryFull>;

  /**
   * Читает последние записи, новые сверху.
   * @param limit Сколько записей вернуть.
   * @param action Код действия для фильтра или `null` — тогда все подряд.
   * @returns Строки журнала.
   */
  findRecent(limit: number, action: string | null): Promise<AuditEntryFull[]>;
}
