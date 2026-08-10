import type { AuditEntryBase } from './audit-entry-base.interface';

/**
 * AuditEntryFull — полная строка `admin_audit_log` (≈ строка БД, ADR-0033): Base + PK и метка
 * времени. Ключи 1:1 с колонками схемы.
 *
 * **`updatedAt` здесь нет намеренно** — в отличие от остальных таблиц проекта. Запись журнала
 * не редактируется: строка, которую можно изменить, журналом не является.
 */
export interface AuditEntryFull extends AuditEntryBase {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда действие произошло. Единственная метка времени: журнал только дописывается. */
  createdAt: Date;
}
